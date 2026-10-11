import { getPrisma } from "@/lib/prisma";
import {
  adminProductSchema,
  type AdminProductValues,
} from "@/lib/validations";
import {
  toProductCategory,
  type ProductRow,
} from "@/lib/data/products";
import type { AdminProduct, ProductBadge, ProductGender } from "@/types";

interface AdminVariantRow {
  size: string;
  color: string;
  stock: number;
  sku: string | null;
}

interface AdminProductRow extends Omit<ProductRow, "variants"> {
  sku: string | null;
  costPrice: number;
  categories: string[];
  variants: AdminVariantRow[];
  lowStockThreshold: number;
  trackInventory: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  featuredOrder: number;
  virtualBoutique: boolean;
  newArrival: boolean;
  bestSeller: boolean;
}

function toAdminProduct(row: AdminProductRow): AdminProduct {
  const category = toProductCategory(row.category);
  const colors = row.colors.length ? row.colors : ["Pink"];
  const stock = row.variants.length
    ? row.variants.reduce((total, variant) => total + variant.stock, 0)
    : row.stock;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.description.slice(0, 96),
    description: row.description,
    price: row.price,
    originalPrice: row.originalPrice ?? undefined,
    compareAtPrice: row.originalPrice ?? undefined,
    currency: "BDT",
    images: row.images.length ? row.images : [`${row.slug}-1`],
    category,
    categories: row.categories.length
      ? row.categories.map(toProductCategory)
      : [category],
    ageRange: row.ageRange,
    gender: (row.gender === "Boys" || row.gender === "Unisex"
      ? row.gender
      : "Girls") as ProductGender,
    colors,
    sizes: row.sizes,
    material: row.material ?? "Organic cotton",
    badge: (row.badge as ProductBadge | null) ?? undefined,
    tags: [],
    rating: 5,
    reviewCount: 0,
    stock,
    variants: row.variants.map((variant) => ({
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      ...(variant.sku ? { sku: variant.sku } : {}),
    })),
    inStock: stock > 0 && row.active,
    featured: row.featured,
    featuredOrder: row.featuredOrder,
    virtualBoutique: row.virtualBoutique,
    newArrival: row.newArrival,
    bestSeller: row.bestSeller,
    status: row.active ? "active" : "draft",
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : (row.createdAt?.toISOString() ?? new Date().toISOString()),
    sku: row.sku ?? `LL-${row.slug.toUpperCase().replace(/[^A-Z0-9-]/g, "-")}`,
    costPrice: row.costPrice,
    lowStockThreshold: row.lowStockThreshold,
    trackInventory: row.trackInventory,
    metaTitle: row.metaTitle ?? `${row.name} | Mukra`,
    metaDescription: row.metaDescription ?? row.description.slice(0, 160),
  };
}

const productInclude = {
  variants: { select: { size: true, color: true, stock: true, sku: true } },
};

export async function getAdminProducts(): Promise<AdminProduct[] | null> {
  const db = await getPrisma();
  if (!db) return null;

  const rows = (await db.product.findMany({
    include: productInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  })) as AdminProductRow[];

  return rows.map(toAdminProduct);
}

export async function saveAdminProduct(
  values: AdminProductValues,
  id?: string,
): Promise<AdminProduct | null> {
  const db = await getPrisma();
  if (!db) return null;

  const colors = values.colors.map((color) => color.name);
  const data = {
    name: values.name,
    slug: values.slug,
    sku: values.sku,
    description: values.description,
    price: values.price,
    costPrice: values.costPrice ?? 0,
    originalPrice: values.compareAtPrice ?? null,
    category: values.category,
    categories: Array.from(new Set(values.categories)),
    gender: values.gender,
    ageRange: `${values.ageMin}-${values.ageMax}Y`,
    material: "Organic cotton",
    colors,
    sizes: values.sizes,
    images: values.images.length ? values.images : [`${values.slug}-1`],
    stock: values.variants.reduce((total, variant) => total + variant.stock, 0),
    lowStockThreshold: values.lowStockThreshold,
    trackInventory: values.trackInventory,
    badge: values.badge === "none" ? null : values.badge,
    featured: values.featured,
    featuredOrder: values.featuredOrder,
    virtualBoutique: values.virtualBoutique,
    newArrival: values.newArrival,
    bestSeller: values.bestSeller,
    active: values.active,
    metaTitle: values.metaTitle?.trim() || `${values.name} | Mukra`,
    metaDescription:
      values.metaDescription?.trim() || values.description.slice(0, 160),
    variants: id
      ? {
          deleteMany: {},
          create: values.variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            sku: variant.sku?.trim() || null,
          })),
        }
      : {
          create: values.variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            sku: variant.sku?.trim() || null,
          })),
        },
  };

  const { material, ...updateData } = data;
  const row = (id
    ? await db.product.update({
        where: { id },
        data: updateData,
        include: productInclude,
      })
    : await db.product.create({
        data: { ...updateData, material },
        include: productInclude,
      })) as AdminProductRow;

  return toAdminProduct(row);
}

export function parseAdminProduct(input: unknown) {
  return adminProductSchema.safeParse(input);
}
