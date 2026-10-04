/**
 * Seed script — the demo dataset, in Postgres.
 *
 *   npx prisma db push     # create the tables
 *   npm run db:seed        # load this file
 *
 * It loads exactly what the storefront shows in demo mode: the 12 catalogue
 * products from `lib/site.ts`, one admin (`admin@littleluxe.com / admin123`),
 * three shoppers (`password123`), the four coupons the console lists and five
 * orders — including two wallet payments waiting for an operator to verify.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { PRODUCTS } from "../lib/site";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const DEMO_PASSWORD = "password123";
const ADMIN_PASSWORD = "admin123";

/** Walks the seeded orders in order, so `at(0)` is the newest. */
interface SeedOrderItem {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

interface SeedOrder {
  orderNumber: string;
  customerIndex: number;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  paymentMethod: "COD" | "BKASH" | "NAGAD" | "ROCKET" | "SSLCOMMERZ" | "CARD";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paymentRef?: string;
  giftWrap?: number;
  discount?: number;
  notes?: string;
  placedAt: string;
  items: SeedOrderItem[];
}

/** Shipping is free over $50, matching `lib/cart.ts`. */
function shippingFor(subtotal: number): number {
  return subtotal >= 50 ? 0 : 4.99;
}

async function main(): Promise<void> {
  const password = await hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const adminPassword = await hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  /* ---------- wipe (idempotent re-runs) ---------- */
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.address.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  /* ---------- users ---------- */
  const admin = await prisma.user.create({
    data: {
      name: "Riajul Khandokar",
      email: "admin@littleluxe.com",
      phone: "+880 1712 345678",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const [sarah, priya, fatima] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Sarah Ahmed",
        email: "sarah@example.com",
        phone: "+880 1712 345678",
        password,
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Priya Khan",
        email: "priya.khan@example.com",
        phone: "+880 1812 445566",
        password,
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Fatima Rahman",
        email: "fatima.rahman@example.com",
        phone: "+880 1913 778899",
        password,
        role: "CUSTOMER",
      },
    }),
  ]);

  const customers = [sarah, priya, fatima];

  /* ---------- catalogue ---------- */
  for (const product of PRODUCTS) {
    await prisma.product.create({
      data: {
        // The catalogue id doubles as the slug, so mock cart lines resolve.
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice ?? null,
        category: product.category,
        gender: product.gender,
        ageRange: product.ageRange,
        material: product.material,
        colors: [...product.colors],
        sizes: [...product.sizes],
        images: [...product.images],
        modelColor: product.modelColor,
        stock: product.stock,
        lowStockThreshold: 10,
        badge: product.badge ?? null,
        featured: product.featured,
        active: product.status === "active",
        createdAt: new Date(product.createdAt),
      },
    });
  }

  /* ---------- addresses ---------- */
  await prisma.address.createMany({
    data: [
      {
        userId: sarah.id,
        name: "Sarah Ahmed",
        phone: "+880 1712 345678",
        address1: "House 24, Road 7",
        address2: "Dhanmondi",
        city: "Dhaka",
        state: "Dhaka Division",
        zip: "1209",
        country: "Bangladesh",
        isDefault: true,
      },
      {
        userId: priya.id,
        name: "Priya Khan",
        phone: "+880 1812 445566",
        address1: "12 Rose Avenue",
        address2: "Gulshan 1",
        city: "Dhaka",
        state: "Dhaka Division",
        zip: "1212",
        country: "Bangladesh",
        isDefault: true,
      },
      {
        userId: fatima.id,
        name: "Fatima Rahman",
        phone: "+880 1913 778899",
        address1: "Suite 400, Marina Tower",
        address2: "Banani",
        city: "Chattogram",
        state: "Chattogram Division",
        zip: "4000",
        country: "Bangladesh",
        isDefault: true,
      },
    ],
  });

  /* ---------- orders ---------- */
  const orders: SeedOrder[] = [
    {
      orderNumber: "LL-2025-00172",
      customerIndex: 2,
      status: "PENDING",
      paymentMethod: "ROCKET",
      paymentStatus: "PENDING",
      paymentRef: "/demo/payments/demo-rocket-receipt.svg",
      placedAt: "2026-10-02T09:41:00.000Z",
      items: [
        { productId: "floral-summer-dress", color: "Pink", size: "4T", quantity: 1 },
        { productId: "butterfly-hair-clips", color: "Rose", size: "One Size", quantity: 2 },
      ],
    },
    {
      orderNumber: "LL-2025-00171",
      customerIndex: 1,
      status: "PENDING",
      paymentMethod: "BKASH",
      paymentStatus: "PENDING",
      paymentRef: "/demo/payments/demo-bkash-receipt.svg",
      placedAt: "2026-10-01T06:10:00.000Z",
      items: [
        { productId: "rainbow-tutu-skirt", color: "Pink", size: "4T", quantity: 1 },
        { productId: "unicorn-backpack", color: "Lavender", size: "One Size", quantity: 1 },
      ],
    },
    {
      orderNumber: "LL-2025-00168",
      customerIndex: 2,
      status: "PROCESSING",
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      giftWrap: 3.99,
      notes: "Customer asked for gift wrapping — added by hand.",
      placedAt: "2026-09-30T11:05:00.000Z",
      items: [{ productId: "cotton-pajama-set", color: "Sky", size: "3T", quantity: 2 }],
    },
    {
      orderNumber: "LL-2025-00165",
      customerIndex: 0,
      status: "SHIPPED",
      paymentMethod: "SSLCOMMERZ",
      paymentStatus: "PAID",
      paymentRef: "SSL-8841-2201",
      placedAt: "2026-09-29T14:20:00.000Z",
      items: [{ productId: "princess-party-gown", color: "Rose", size: "6", quantity: 1 }],
    },
    {
      orderNumber: "LL-2025-00160",
      customerIndex: 1,
      status: "DELIVERED",
      paymentMethod: "BKASH",
      paymentStatus: "PAID",
      paymentRef: "8N7A2K4LQ1",
      placedAt: "2026-09-20T09:15:00.000Z",
      items: [{ productId: "dino-graphic-tee", color: "Mint", size: "5", quantity: 2 }],
    },
  ];

  for (const seed of orders) {
    const customer = customers[seed.customerIndex];
    if (!customer) throw new Error(`seed: no customer at index ${seed.customerIndex}`);

    const lines = seed.items.map((item) => {
      const product = PRODUCTS.find((entry) => entry.id === item.productId);
      if (!product) throw new Error(`seed: unknown product "${item.productId}"`);

      return {
        productId: product.id,
        name: product.name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const shipping = shippingFor(subtotal);
    const giftWrap = seed.giftWrap ?? 0;
    const discount = seed.discount ?? 0;

    await prisma.order.create({
      data: {
        orderNumber: seed.orderNumber,
        userId: customer.id,
        subtotal,
        shipping,
        discount,
        giftWrap,
        total: Math.max(0, subtotal + shipping + giftWrap - discount),
        status: seed.status,
        paymentMethod: seed.paymentMethod,
        paymentStatus: seed.paymentStatus,
        paymentRef: seed.paymentRef ?? null,
        shippingName: customer.name,
        shippingEmail: customer.email,
        shippingPhone: customer.phone ?? "+880 1700 000000",
        shippingAddress:
          customer.id === sarah.id ? "House 24, Road 7, Dhanmondi" : "12 Rose Avenue, Gulshan 1",
        shippingCity: "Dhaka",
        shippingZip: "1209",
        shippingCountry: "Bangladesh",
        notes: seed.notes ?? null,
        estimatedDelivery: new Date(new Date(seed.placedAt).getTime() + 7 * 86_400_000),
        createdAt: new Date(seed.placedAt),
        items: { create: lines },
      },
    });
  }

  /* ---------- coupons ---------- */
  await prisma.coupon.createMany({
    data: [
      {
        code: "WELCOME10",
        type: "PERCENTAGE",
        value: 10,
        minOrder: 50,
        usageLimit: 100,
        usedCount: 45,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        active: true,
      },
      {
        code: "SUMMER25",
        type: "FIXED",
        value: 25,
        minOrder: 100,
        usageLimit: 50,
        usedCount: 12,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-11-30"),
        active: true,
      },
      {
        code: "FREESHIP",
        type: "FREE_SHIPPING",
        value: 0,
        minOrder: 0,
        usedCount: 89,
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-12-31"),
        active: true,
      },
      {
        code: "BIRTHDAY",
        type: "PERCENTAGE",
        value: 20,
        minOrder: 30,
        usageLimit: 20,
        usedCount: 5,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-08-15"),
        active: false,
      },
    ],
  });

  /* ---------- reviews + wishlist ---------- */
  await prisma.review.createMany({
    data: [
      {
        userId: sarah.id,
        productId: "floral-summer-dress",
        rating: 5,
        comment: "Soft, bright and survived three washes already. Twirls beautifully.",
      },
      {
        userId: priya.id,
        productId: "dino-graphic-tee",
        rating: 4,
        comment: "Thicker cotton than expected — great value.",
      },
    ],
  });

  await prisma.wishlistItem.createMany({
    data: [
      { userId: sarah.id, productId: "princess-party-gown" },
      { userId: priya.id, productId: "light-up-sneakers" },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    orders: await prisma.order.count(),
    coupons: await prisma.coupon.count(),
    admin: admin.email,
  };

  console.warn("[seed] Little Luxe ready 🌟", counts);
}

main()
  .catch((error: unknown) => {
    console.warn("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
