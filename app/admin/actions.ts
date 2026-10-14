"use server";

/**
 * Admin console Server Actions.
 *
 * Every mutation the console performs goes through this file: Zod-validated,
 * role-guarded, written to Postgres through Prisma, then revalidated so the
 * console *and* the storefront pick the change up on the next render.
 *
 * Three rules, in order:
 *
 * 1. **Auth first.** The middleware blocks `/admin/*` for anyone without a
 *    console role, but a Server Action is a public POST endpoint — so each one
 *    re-checks the session *and* the caller's role before touching data. The
 *    role matrix lives in `lib/rbac.ts`: `SUPER_ADMIN` can do everything,
 *    `INVENTORY_MANAGER` owns products/categories, `SEO_MANAGER` owns product
 *    metadata and settings, `SUPPORT_MANAGER` owns orders/returns/customers, and
 *    only `SUPER_ADMIN` can move accounts between those roles
 *    (`updateUserRoleAction`).
 * 2. **Validate everything.** Arguments arrive from the browser as `unknown`
 *    and are parsed with the shared Zod schemas in `lib/validations.ts`.
 * 3. **Never fake a write.** With `DATABASE_URL` configured, a failure is
 *    returned as `{ ok: false, error }` and the console shows a toast — the
 *    demo fallback in `lib/prisma.ts` (`withDatabase`) is never used here, so an
 *    authenticated admin can't be told a change was saved when it wasn't. With
 *    no database at all the action answers `source: "demo"` and the console
 *    applies the change to its in-session Zustand store, exactly as before.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/demo-mode";
import {
  ASSIGNABLE_ROLES,
  checkRoleChange,
  rolesForPermission,
  type AdminPermission,
} from "@/lib/rbac";
import { describeAdminError } from "@/lib/data/admin-errors";
import {
  deleteAdminProducts,
  duplicateAdminProduct,
  persistAdminProduct,
  restockAdminProduct,
  setAdminProductsOutOfStock,
  updateAdminProductSeo,
} from "@/lib/data/admin-products";
import {
  appendAdminOrderNote,
  decideAdminManualPayment,
  refundAdminOrder,
  updateAdminOrderStatus,
  type PaymentDecision,
} from "@/lib/data/admin-orders";
import { deleteAdminCategory, saveAdminCategory } from "@/lib/data/categories";
import { getAdminUserAccounts, updateAdminUserRole } from "@/lib/data/admin-users";
import { getDemoUserAccounts, setDemoUserRole } from "@/lib/data/users";
import {
  adminCategorySchema,
  adminProductSchema,
  adminProductSeoSchema,
} from "@/lib/validations";
import type {
  AdminCategory,
  AdminOrder,
  AdminOrderStatus,
  AdminProduct,
  AdminUser,
  AdminUserAccount,
} from "@/types";

/* -------------------------------------------------------------------------- */
/*  Result envelope                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `source: "database"` — the write committed; `data` is the saved record.
 * `source: "demo"` — no database is configured, nothing was persisted and the
 * console applies the change to its in-session store.
 */
export type AdminActionResult<T> =
  | { ok: true; source: "database" | "demo"; data: T | null }
  | { ok: false; error: string };

/** Shared "demo install" answer: the client keeps its in-session behaviour. */
function demo<T>(): AdminActionResult<T> {
  return { ok: true, source: "demo", data: null };
}

function failure<T>(error: unknown, fallback: string): AdminActionResult<T> {
  return { ok: false, error: describeAdminError(error, fallback) };
}

/* -------------------------------------------------------------------------- */
/*  RBAC                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the session and checks it against the roles that hold `permission`
 * (`lib/rbac.ts`). Every action calls this before it touches Prisma.
 */
async function requirePermission(
  permission: AdminPermission,
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  const gate = await requireActionRole(rolesForPermission(permission));
  if (!gate.ok) return { ok: false, error: gate.message };
  return { ok: true, user: gate.user };
}

/* -------------------------------------------------------------------------- */
/*  Input schemas                                                             */
/* -------------------------------------------------------------------------- */

const idSchema = z.string().trim().min(1, "A record id is required");
const idsSchema = z.array(idSchema).min(1, "Select at least one record").max(200);

const restockSchema = z.coerce
  .number()
  .int("Whole units only")
  .min(1, "Add at least one unit")
  .max(10_000, "That is too many units for one restock");

/** Order numbers are accepted with or without the console's leading "#". */
const orderNumberSchema = z
  .string()
  .trim()
  .min(4, "An order number is required")
  .max(64, "That order number is too long")
  .transform((value) => value.replace(/^#+/, ""));

const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

const paymentDecisionSchema = z.enum(["approve", "reject", "collect-cash"]);

const orderNoteSchema = z
  .string()
  .trim()
  .min(1, "Write a note first")
  .max(1_000, "Keep notes under 1,000 characters");

/* -------------------------------------------------------------------------- */
/*  Revalidation                                                              */
/* -------------------------------------------------------------------------- */

/** Product edits show up in the console, the storefront and the sitemap. */
function revalidateProductPaths(slug?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/api/products");
  revalidatePath("/sitemap.xml");
  revalidatePath("/product/[id]", "page");
  if (slug) revalidatePath(`/product/${encodeURIComponent(slug)}`);
}

/** Order changes show up in the console and in the shopper's account area. */
function revalidateOrderPaths(orderNumber?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders/[id]", "page");
  revalidatePath("/api/orders");
  if (orderNumber) {
    revalidatePath(`/dashboard/orders/${encodeURIComponent(orderNumber)}`);
  }
}

function revalidateCategoryPaths(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
}

/* -------------------------------------------------------------------------- */
/*  Products                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Creates or updates a product — including `featuredOrder`, the display
 * placements (`categories`, `virtualBoutique`, `newArrival`, `bestSeller`,
 * `featured`) and publication (`active`).
 */
export async function saveProductAction(
  input: unknown,
  productId?: string,
): Promise<AdminActionResult<AdminProduct>> {
  const gate = await requirePermission("products:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = adminProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  }

  const id = productId === undefined ? null : idSchema.safeParse(productId);
  if (id && !id.success) return { ok: false, error: "Invalid product id" };

  if (!isDatabaseConfigured()) return demo();

  try {
    const product = await persistAdminProduct(
      parsed.data,
      id?.success ? id.data : undefined,
    );

    revalidateProductPaths(product.slug);
    return { ok: true, source: "database", data: product };
  } catch (error) {
    return failure<AdminProduct>(error, "Could not save the product");
  }
}

/** Deletes one or more products (variants cascade with them). */
export async function deleteProductsAction(
  ids: string[],
): Promise<AdminActionResult<{ deleted: number }>> {
  const gate = await requirePermission("products:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nothing selected" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const deleted = await deleteAdminProducts(parsed.data);
    revalidateProductPaths();
    return { ok: true, source: "database", data: { deleted } };
  } catch (error) {
    return failure<{ deleted: number }>(error, "Could not delete the selected products");
  }
}

/**
 * The SEO manager's write path: slug, metadata, badge, publication and display
 * placement only (`adminProductSeoSchema`). Inventory fields are never touched,
 * so an SEO edit can't clobber a stock or pricing change.
 */
export async function saveProductSeoAction(
  productId: string,
  input: unknown,
): Promise<AdminActionResult<AdminProduct>> {
  const gate = await requirePermission("products:seo");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedId = idSchema.safeParse(productId);
  if (!parsedId.success) return { ok: false, error: "Invalid product id" };

  const parsed = adminProductSeoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product metadata" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const product = await updateAdminProductSeo(parsedId.data, parsed.data);

    revalidateProductPaths(product.slug);
    return { ok: true, source: "database", data: product };
  } catch (error) {
    return failure<AdminProduct>(error, "Could not save the product metadata");
  }
}

/** Copies a product as an unpublished draft. */
export async function duplicateProductAction(
  id: string,
): Promise<AdminActionResult<AdminProduct>> {
  const gate = await requirePermission("products:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid product id" };

  if (!isDatabaseConfigured()) return demo();

  try {
    const product = await duplicateAdminProduct(parsed.data);
    revalidateProductPaths(product.slug);
    return { ok: true, source: "database", data: product };
  } catch (error) {
    return failure<AdminProduct>(error, "Could not duplicate the product");
  }
}

/** Bulk action: zeroes stock on the products and every one of their variants. */
export async function setProductsOutOfStockAction(
  ids: string[],
): Promise<AdminActionResult<{ updated: number }>> {
  const gate = await requirePermission("products:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nothing selected" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const updated = await setAdminProductsOutOfStock(parsed.data);
    revalidateProductPaths();
    return { ok: true, source: "database", data: { updated } };
  } catch (error) {
    return failure<{ updated: number }>(error, "Could not update stock for the selected products");
  }
}

/** Adds units to a product, spread across its variants. */
export async function restockProductAction(
  id: string,
  units: number,
): Promise<AdminActionResult<AdminProduct>> {
  const gate = await requirePermission("products:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedId = idSchema.safeParse(id);
  const parsedUnits = restockSchema.safeParse(units);
  if (!parsedId.success) return { ok: false, error: "Invalid product id" };
  if (!parsedUnits.success) {
    return { ok: false, error: parsedUnits.error.issues[0]?.message ?? "Invalid quantity" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const product = await restockAdminProduct(parsedId.data, parsedUnits.data);
    revalidateProductPaths(product.slug);
    return { ok: true, source: "database", data: product };
  } catch (error) {
    return failure<AdminProduct>(error, "Could not restock the product");
  }
}

/* -------------------------------------------------------------------------- */
/*  Orders                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Moves an order along the fulfilment flow:
 * Pending → Processing (a verified payment) → Shipped → Delivered, or
 * Cancelled / Refunded.
 */
export async function updateOrderStatusAction(
  orderNumber: string,
  status: AdminOrderStatus,
  note?: string,
): Promise<AdminActionResult<AdminOrder>> {
  const gate = await requirePermission("orders:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedNumber = orderNumberSchema.safeParse(orderNumber);
  const parsedStatus = orderStatusSchema.safeParse(status);
  const parsedNote = note === undefined ? null : orderNoteSchema.safeParse(note);

  if (!parsedNumber.success) {
    return { ok: false, error: parsedNumber.error.issues[0]?.message ?? "Invalid order" };
  }
  if (!parsedStatus.success) return { ok: false, error: "Unknown order status" };
  if (parsedNote && !parsedNote.success) {
    return { ok: false, error: parsedNote.error.issues[0]?.message ?? "Invalid note" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const order = await updateAdminOrderStatus(
      parsedNumber.data,
      parsedStatus.data,
      parsedNote?.success ? parsedNote.data : undefined,
    );
    revalidateOrderPaths(parsedNumber.data);
    return { ok: true, source: "database", data: order };
  } catch (error) {
    return failure<AdminOrder>(error, "Could not update the order status");
  }
}

/**
 * Verifies (or rejects) a manual wallet payment after the operator has checked
 * the bKash / Nagad / Rocket screenshot — or records cash collected on a COD
 * delivery.
 */
export async function decidePaymentAction(
  orderNumber: string,
  decision: PaymentDecision,
): Promise<AdminActionResult<AdminOrder>> {
  const gate = await requirePermission("orders:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedNumber = orderNumberSchema.safeParse(orderNumber);
  const parsedDecision = paymentDecisionSchema.safeParse(decision);

  if (!parsedNumber.success) {
    return { ok: false, error: parsedNumber.error.issues[0]?.message ?? "Invalid order" };
  }
  if (!parsedDecision.success) return { ok: false, error: "Unknown payment decision" };

  if (!isDatabaseConfigured()) return demo();

  try {
    const order = await decideAdminManualPayment(parsedNumber.data, parsedDecision.data);
    revalidateOrderPaths(parsedNumber.data);
    return { ok: true, source: "database", data: order };
  } catch (error) {
    return failure<AdminOrder>(error, "Could not record the payment decision");
  }
}

/** Appends an internal note to the order's audit trail. */
export async function addOrderNoteAction(
  orderNumber: string,
  note: string,
): Promise<AdminActionResult<AdminOrder>> {
  const gate = await requirePermission("orders:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedNumber = orderNumberSchema.safeParse(orderNumber);
  const parsedNote = orderNoteSchema.safeParse(note);

  if (!parsedNumber.success) {
    return { ok: false, error: parsedNumber.error.issues[0]?.message ?? "Invalid order" };
  }
  if (!parsedNote.success) {
    return { ok: false, error: parsedNote.error.issues[0]?.message ?? "Invalid note" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const order = await appendAdminOrderNote(parsedNumber.data, parsedNote.data);
    revalidateOrderPaths(parsedNumber.data);
    return { ok: true, source: "database", data: order };
  } catch (error) {
    return failure<AdminOrder>(error, "Could not add the note");
  }
}

/** Refunds an order in full and closes it. */
export async function refundOrderAction(
  orderNumber: string,
  note?: string,
): Promise<AdminActionResult<AdminOrder>> {
  const gate = await requirePermission("orders:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedNumber = orderNumberSchema.safeParse(orderNumber);
  const parsedNote = note === undefined ? null : orderNoteSchema.safeParse(note);

  if (!parsedNumber.success) {
    return { ok: false, error: parsedNumber.error.issues[0]?.message ?? "Invalid order" };
  }
  if (parsedNote && !parsedNote.success) {
    return { ok: false, error: parsedNote.error.issues[0]?.message ?? "Invalid note" };
  }

  if (!isDatabaseConfigured()) return demo();

  try {
    const order = await refundAdminOrder(
      parsedNumber.data,
      parsedNote?.success ? parsedNote.data : undefined,
    );
    revalidateOrderPaths(parsedNumber.data);
    return { ok: true, source: "database", data: order };
  } catch (error) {
    return failure<AdminOrder>(error, "Could not refund the order");
  }
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

/** Creates or updates a category's metadata (name, slug, emoji, blurb, parent). */
export async function saveCategoryAction(
  input: unknown,
  categoryId?: string,
): Promise<AdminActionResult<AdminCategory>> {
  const gate = await requirePermission("categories:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = adminCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category" };
  }

  const id = categoryId === undefined ? null : idSchema.safeParse(categoryId);
  if (id && !id.success) return { ok: false, error: "Invalid category id" };

  if (!isDatabaseConfigured()) return demo();

  try {
    const category = await saveAdminCategory(
      parsed.data,
      id?.success ? id.data : undefined,
    );
    revalidateCategoryPaths();
    return { ok: true, source: "database", data: category };
  } catch (error) {
    return failure<AdminCategory>(error, "Could not save the category");
  }
}

/** Removes a category. Products keep their category name until reassigned. */
export async function deleteCategoryAction(
  id: string,
): Promise<AdminActionResult<{ deleted: true }>> {
  const gate = await requirePermission("categories:write");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid category id" };

  if (!isDatabaseConfigured()) return demo();

  try {
    await deleteAdminCategory(parsed.data);
    revalidateCategoryPaths();
    return { ok: true, source: "database", data: { deleted: true } };
  } catch (error) {
    return failure<{ deleted: true }>(error, "Could not delete the category");
  }
}

/* -------------------------------------------------------------------------- */
/*  Staff & Roles (super admin only)                                          */
/* -------------------------------------------------------------------------- */

/** The five assignable roles — `ADMIN` is a legacy value, never written back. */
const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

/** Everything a role change can visibly affect. */
function revalidateUserPaths(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/staff");
  revalidatePath("/admin/customers");
}

/**
 * Moves one account to a new role.
 *
 * **Super admin only** (`users:manage`), and the rest of the policy lives in
 * `checkRoleChange()` (`lib/rbac.ts`) so it can be read and tested on its own:
 * nobody may change their own role, and the last super admin may not be demoted.
 *
 * Deletion is deliberately not offered anywhere: a role can always be taken
 * away, but accounts are never removed from the console.
 */
export async function updateUserRoleAction(
  userId: string,
  newRole: unknown,
): Promise<AdminActionResult<AdminUserAccount>> {
  const gate = await requirePermission("users:manage");
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsedId = idSchema.safeParse(userId);
  if (!parsedId.success) return { ok: false, error: "Invalid account id" };

  const parsedRole = assignableRoleSchema.safeParse(newRole);
  if (!parsedRole.success) {
    return { ok: false, error: "Choose one of the five roles" };
  }
  const role = parsedRole.data;

  const database = isDatabaseConfigured();
  let accounts: AdminUserAccount[];
  if (database) {
    const rows = await getAdminUserAccounts();
    if (!rows) return { ok: false, error: "Could not load the account list — try again" };
    accounts = rows;
  } else {
    accounts = getDemoUserAccounts();
  }

  const target = accounts.find((account) => account.id === parsedId.data);
  if (!target) {
    return { ok: false, error: "That account no longer exists — reload the console" };
  }

  /* Choosing the role the account already has is a no-op, not an error. */
  if (target.role === role) {
    return { ok: true, source: database ? "database" : "demo", data: target };
  }

  const verdict = checkRoleChange({
    accounts,
    actorId: gate.user.id,
    actorEmail: gate.user.email,
    targetId: target.id,
    newRole: role,
  });
  if (!verdict.ok) return { ok: false, error: verdict.error };

  if (!database) {
    const updated = setDemoUserRole(target.id, role);
    if (!updated) return { ok: false, error: "That demo account no longer exists" };
    revalidateUserPaths();
    return { ok: true, source: "demo", data: updated };
  }

  try {
    const updated = await updateAdminUserRole(target.id, role);
    revalidateUserPaths();
    return { ok: true, source: "database", data: updated };
  } catch (error) {
    return failure<AdminUserAccount>(error, "Could not update that role");
  }
}
