"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCategory, AdminOrder, AdminProduct } from "@/types";

interface AdminDataHydratorProps {
  /**
   * Records loaded on the server for this request. `null`/`undefined` means
   * "no database configured" — the console then keeps its in-session demo
   * dataset instead of clearing the tables.
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

  return <>{children}</>;
}
