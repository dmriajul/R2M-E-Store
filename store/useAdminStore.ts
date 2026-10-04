"use client";

import { create } from "zustand";
import { slugify } from "@/lib/utils";
import { COLOR_HEX, DEFAULT_SWATCH } from "@/lib/site";
import {
  ADMIN_CATEGORIES,
  ADMIN_COUPONS,
  ADMIN_CUSTOMERS,
  ADMIN_ORDERS,
  ADMIN_SETTINGS,
  buildAdminProducts,
  buildAdminTimeline,
} from "@/lib/mock-admin";
import type { AdminCategoryValues, AdminCouponValues, AdminProductValues } from "@/lib/validations";
import type {
  AdminCategory,
  AdminCoupon,
  AdminCustomer,
  AdminOrder,
  AdminOrderStatus,
  AdminProduct,
  AdminSettings,
  Product,
  ProductBadge,
} from "@/types";

/** Turns submitted form values into the console's product record. */
function applyProductValues(
  base: Partial<Product>,
  values: AdminProductValues,
  id: string,
): AdminProduct {
  const firstColor = values.colors[0]?.name ?? "Default";
  const badge: ProductBadge | undefined = values.badge === "none" ? undefined : values.badge;
  const compareAt =
    values.compareAtPrice && values.compareAtPrice > values.price
      ? values.compareAtPrice
      : undefined;

  return {
    id,
    slug: values.slug,
    name: values.name,
    tagline: values.description.slice(0, 96),
    description: values.description,
    price: values.price,
    originalPrice: compareAt,
    compareAtPrice: compareAt,
    currency: "USD",
    images: values.images.length > 0 ? values.images : [`${id}-1`],
    category: values.category,
    ageRange: `${values.ageMin}-${values.ageMax}Y`,
    gender: values.gender,
    colors: values.colors.map((color) => color.name),
    sizes: values.sizes,
    material: base.material ?? "Organic cotton",
    badge,
    modelColor: COLOR_HEX[firstColor] ?? DEFAULT_SWATCH,
    tags: base.tags ?? [],
    rating: base.rating ?? 5,
    reviewCount: base.reviewCount ?? 0,
    stock: values.stock,
    inStock: values.stock > 0,
    featured: values.featured,
    status: values.active ? "active" : "draft",
    createdAt: base.createdAt ?? new Date().toISOString(),

    sku: values.sku,
    costPerItem: values.costPerItem ?? 0,
    lowStockThreshold: values.lowStockThreshold,
    trackInventory: values.trackInventory,
    metaTitle: values.metaTitle?.trim() ? values.metaTitle : `${values.name} | Little Luxe`,
    metaDescription: values.metaDescription?.trim()
      ? values.metaDescription
      : values.description.slice(0, 160),
    modelUrl: values.modelUrl,
  };
}

interface AdminState {
  products: AdminProduct[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  coupons: AdminCoupon[];
  categories: AdminCategory[];
  settings: AdminSettings;
  /** Term handed over by the top-bar search so the tables open pre-filtered. */
  search: string;

  setSearch: (value: string) => void;

  saveProduct: (values: AdminProductValues, id?: string) => string;
  deleteProducts: (ids: string[]) => void;
  duplicateProduct: (id: string) => string | undefined;
  setProductsOutOfStock: (ids: string[]) => void;
  restockProduct: (id: string, units: number) => void;

  updateOrderStatus: (id: string, status: AdminOrderStatus) => void;
  addOrderNote: (id: string, note: string) => void;
  refundOrder: (id: string) => void;

  /* Manual-payment verification (Step 7). */
  verifyPayment: (id: string) => void;
  rejectPayment: (id: string, reason?: string) => void;
  markCashPaid: (id: string) => void;

  toggleCustomerActive: (id: string) => void;

  saveCoupon: (values: AdminCouponValues, id?: string) => string;
  deleteCoupon: (id: string) => void;

  saveCategory: (values: AdminCategoryValues, id?: string) => string;
  deleteCategory: (id: string) => void;

  saveSettings: (next: AdminSettings) => void;
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  products: buildAdminProducts(),
  orders: [...ADMIN_ORDERS],
  customers: [...ADMIN_CUSTOMERS],
  coupons: [...ADMIN_COUPONS],
  categories: [...ADMIN_CATEGORIES],
  settings: ADMIN_SETTINGS,
  search: "",

  setSearch: (value) => set({ search: value }),

  saveProduct: (values, id) => {
    const productId = id ?? slugify(values.slug || values.name);
    const existing = get().products.find((product) => product.id === productId);
    const next = applyProductValues(existing ?? {}, values, productId);

    set((state) => ({
      products: existing
        ? state.products.map((product) => (product.id === productId ? next : product))
        : [next, ...state.products],
    }));

    return productId;
  },

  deleteProducts: (ids) =>
    set((state) => ({
      products: state.products.filter((product) => !ids.includes(product.id)),
    })),

  duplicateProduct: (id) => {
    const source = get().products.find((product) => product.id === id);
    if (!source) return undefined;

    let copyId = `${id}-copy`;
    let suffix = 2;
    while (get().products.some((product) => product.id === copyId)) {
      copyId = `${id}-copy-${suffix}`;
      suffix += 1;
    }

    const copy: AdminProduct = {
      ...source,
      id: copyId,
      slug: copyId,
      name: `${source.name} (Copy)`,
      sku: `${source.sku}-C${suffix - 1}`,
      status: "draft",
      featured: false,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({ products: [copy, ...state.products] }));
    return copyId;
  },

  setProductsOutOfStock: (ids) =>
    set((state) => ({
      products: state.products.map((product) =>
        ids.includes(product.id) ? { ...product, stock: 0, inStock: false } : product,
      ),
    })),

  restockProduct: (id, units) =>
    set((state) => ({
      products: state.products.map((product) =>
        product.id === id ? { ...product, stock: product.stock + units, inStock: true } : product,
      ),
    })),

  updateOrderStatus: (id, status) =>
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== id) return order;
        const next: AdminOrder = { ...order, status };
        return { ...next, timeline: buildAdminTimeline(next) };
      }),
    })),

  addOrderNote: (id, note) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === id ? { ...order, notes: [...order.notes, note] } : order,
      ),
    })),

  refundOrder: (id) =>
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== id) return order;
        const next: AdminOrder = {
          ...order,
          status: "refunded",
          notes: [...order.notes, "Refund issued in full."],
        };
        return { ...next, timeline: buildAdminTimeline(next) };
      }),
    })),

  verifyPayment: (id) =>
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== id) return order;
        const next: AdminOrder = {
          ...order,
          // The console's status set has no "confirmed" — a verified payment
          // moves the order straight into preparation.
          status: "processing",
          paymentStatus: "PAID",
          notes: [...order.notes, "Payment verified by an operator."],
        };
        return { ...next, timeline: buildAdminTimeline(next) };
      }),
    })),

  rejectPayment: (id, reason) =>
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== id) return order;
        const next: AdminOrder = {
          ...order,
          status: "cancelled",
          paymentStatus: "FAILED",
          notes: [...order.notes, reason ?? "Payment could not be verified — order cancelled."],
        };
        return { ...next, timeline: buildAdminTimeline(next) };
      }),
    })),

  markCashPaid: (id) =>
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== id) return order;
        const next: AdminOrder = {
          ...order,
          status: "delivered",
          paymentStatus: "PAID",
          notes: [...order.notes, "Cash collected by the delivery partner."],
        };
        return { ...next, timeline: buildAdminTimeline(next) };
      }),
    })),

  toggleCustomerActive: (id) =>
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id === id ? { ...customer, active: !customer.active } : customer,
      ),
    })),

  saveCoupon: (values, id) => {
    const couponId = id ?? `coupon-${slugify(values.code)}`;
    const existing = get().coupons.find((coupon) => coupon.id === couponId);

    const entry: AdminCoupon = {
      id: couponId,
      code: values.code.trim().toUpperCase(),
      type: values.type,
      value: values.type === "free-shipping" ? 0 : values.value,
      minOrder: values.minOrder,
      uses: existing?.uses ?? 0,
      usageLimit: values.usageLimit,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      categories: values.categories,
      active: values.active,
    };

    set((state) => ({
      coupons: existing
        ? state.coupons.map((coupon) => (coupon.id === couponId ? entry : coupon))
        : [entry, ...state.coupons],
    }));

    return couponId;
  },

  deleteCoupon: (id) =>
    set((state) => ({ coupons: state.coupons.filter((coupon) => coupon.id !== id) })),

  saveCategory: (values, id) => {
    const categoryId = id ?? `cat-${slugify(values.slug || values.name)}`;
    const existing = get().categories.find((category) => category.id === categoryId);

    const entry: AdminCategory = {
      id: categoryId,
      name: values.name,
      slug: values.slug,
      emoji: values.emoji,
      description: values.description?.trim() ? values.description : "New category",
      parent: values.parent ? values.parent : null,
    };

    set((state) => ({
      categories: existing
        ? state.categories.map((category) => (category.id === categoryId ? entry : category))
        : [...state.categories, entry],
    }));

    return categoryId;
  },

  deleteCategory: (id) =>
    set((state) => ({ categories: state.categories.filter((category) => category.id !== id) })),

  saveSettings: (next) => set({ settings: next }),
}));
