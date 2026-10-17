/**
 * Seed script — production bootstrap.
 *
 *   npx prisma db push     # create the tables
 *   npm run db:seed        # run this file
 *
 * It creates exactly one thing: the first SUPER_ADMIN account, so you can sign
 * in to the console and add the real catalogue. Credentials come from the
 * environment (see `.env.example`) and are never hardcoded.
 *
 *   ADMIN_NAME="Your Name"
 *   ADMIN_EMAIL="you@example.com"
 *   ADMIN_PASSWORD="a-long-random-password"
 *
 * There are no demo products, orders, coupons or customers here — the database
 * starts empty, and the storefront shows its empty states until you add real
 * products through the console (Admin → Products → Add Product).
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

function readAdminEnv(): { name: string; email: string; password: string } {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";

  const missing = [
    ["ADMIN_NAME", name],
    ["ADMIN_EMAIL", email],
    ["ADMIN_PASSWORD", password],
  ].filter(([, value]) => !value || String(value).trim().length === 0);

  if (missing.length > 0) {
    const keys = missing.map(([key]) => key).join(", ");
    throw new Error(
      `Set ${keys} in your environment (or .env) before seeding. ` +
        "The super-admin account is created from environment variables — " +
        "there are no default demo credentials.",
    );
  }

  return { name: name!, email: email!, password };
}

async function main(): Promise<void> {
  const { name, email, password } = readAdminEnv();

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (existing) {
    // Idempotent re-runs: promote an existing account instead of failing.
    if (existing.role !== "SUPER_ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "SUPER_ADMIN" } });
      console.warn(`[seed] ${email} already existed — promoted to SUPER_ADMIN.`);
    } else {
      console.warn(`[seed] ${email} is already a SUPER_ADMIN; nothing to do.`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: await hash(password, BCRYPT_ROUNDS),
      role: "SUPER_ADMIN",
    },
  });

  console.warn(`[seed] SUPER_ADMIN ${email} created. Sign in at /login, then add your products.`);
}

main()
  .catch((error: unknown) => {
    console.warn("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
