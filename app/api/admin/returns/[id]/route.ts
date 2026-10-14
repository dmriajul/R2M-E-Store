import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { returnRequestInclude, hydrateReturnRequest } from "@/lib/data/returns";
import { getPrisma } from "@/lib/prisma";
import { returnAdminActionSchema } from "@/lib/validations";
import type { ApiResponse, ReturnRequestRecord } from "@/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiResponse<{ request: ReturnRequestRecord; notification: string }>>> {
  const gate = await requireActionRole(rolesForPermission("returns:write"));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.message, success: false },
      { status: gate.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Expected a JSON body", success: false }, { status: 400 });
  }
  const parsed = returnAdminActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid action", success: false }, { status: 422 });
  }

  const db = await getPrisma();
  if (!db) {
    return NextResponse.json({ data: null, error: "Return management requires a configured database", success: false }, { status: 503 });
  }
  const { id } = await context.params;

  try {
    const updated = await db.$transaction(async (tx) => {
      const found = (await tx.returnRequest.findUnique({
        where: { id },
        include: { orderItem: true },
      })) as unknown as Record<string, unknown> | null;
      if (!found) throw new Error("NOT_FOUND");

      const action = parsed.data.action;
      const currentStatus = String(found.status);
      if (action === "approve" || action === "reject") {
        if (currentStatus !== "PENDING") throw new Error("INVALID_STATUS");
        if (action === "approve" && parsed.data.restock) {
          const item = found.orderItem as Record<string, unknown>;
          const variant = await tx.productVariant.updateMany({
            where: { productId: item.productId, size: item.size, color: item.color },
            data: { stock: { increment: Number(item.quantity) } },
          });
          if (variant.count === 0) throw new Error("VARIANT_NOT_FOUND");
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: Number(item.quantity) } },
          });
        }
      } else if (currentStatus !== "APPROVED" && currentStatus !== "RECEIVED") {
        throw new Error("INVALID_STATUS");
      }

      const data = action === "approve"
        ? { status: "APPROVED" }
        : action === "reject"
          ? { status: "REJECTED", adminNote: parsed.data.adminNote }
          : { status: "COMPLETED" };
      const result = await tx.returnRequest.updateMany({
        where: { id, status: currentStatus },
        data,
      });
      if (result.count !== 1) throw new Error("INVALID_STATUS");

      const row = (await tx.returnRequest.findUnique({
        where: { id },
        include: returnRequestInclude,
      })) as unknown as Record<string, unknown>;
      return hydrateReturnRequest(row);
    });

    const notification = updated.status === "APPROVED"
      ? "Your return request has been approved. We will contact you with the next steps."
      : updated.status === "REJECTED"
        ? `Your return request was declined. ${updated.adminNote ?? ""}`.trim()
        : "Your refund has been processed or your exchange has been dispatched.";
    return NextResponse.json({
      data: { request: updated, notification },
      error: null,
      success: true,
      source: "database",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ data: null, error: "Return request not found", success: false }, { status: 404 });
    }
    if (message === "VARIANT_NOT_FOUND") {
      return NextResponse.json({ data: null, error: "The original product variant is not tracked in inventory", success: false }, { status: 409 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json({ data: null, error: "This request has already been reviewed or cannot be completed yet", success: false }, { status: 409 });
    }
    throw error;
  }
}
