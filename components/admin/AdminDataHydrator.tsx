"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCategory, AdminOrder, AdminProduct } from "@/types";

interface AdminDataHydratorProps {
  /**
   * Records loaded on the server for this request. `null`/`undefined` means
   * "the database could not be read" — the console then renders empty tables
   * plus the connection notice below instead of any sample rows.
   */
  products?: AdminProduct[] | null;
  orders?: AdminOrder[] | null;
  categories?: AdminCategory[] | null;
  children: React.ReactNode;
}

/**
 * Bridges the server (Postgres through Prisma) and the console's client store.
 *
 * `app/admin/layout.tsx` loads every collection the console renders and hands
 * the rows down here, so a signed-in operator always looks at rows that exist
 * in the database — which is what makes the Server Action mutations (keyed by
 * id / order number) line up with real records.
 */
export function AdminDataHydrator({
  products,
  orders,
  categories,
  children,
}: AdminDataHydratorProps) {
  const setProducts = useAdminStore((state) => state.setProducts);
  const setOrders = useAdminStore((state) => state.setOrders);
  const setCategories = useAdminStore((state) => state.setCategories);

  useEffect(() => {
    if (products) setProducts(products);
    if (orders) setOrders(orders);
    if (categories) setCategories(categories);
  }, [products, orders, categories, setProducts, setOrders, setCategories]);

  const disconnected = !products || !orders || !categories;

  return (
    <>
      {disconnected && (
        <p
          role="status"
          className="rounded-xl border border-amber-500/35 bg-amber-500/8 px-4 py-3 text-[11px] leading-relaxed text-amber-300"
        >
          Could not read from the database — the tables below show no rows. Check
          <code className="mx-1 rounded bg-black/30 px-1 py-0.5">DATABASE_URL</code>
          and run
          <code className="mx-1 rounded bg-black/30 px-1 py-0.5">npx prisma generate</code>.
        </p>
      )}
      {children}
    </>
  );
}
