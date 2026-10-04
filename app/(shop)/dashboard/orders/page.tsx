"use client";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { OrdersExplorer } from "@/components/dashboard/OrdersExplorer";

export default function DashboardOrdersPage() {
  return (
    <>
      <title>My Orders | LITTLE LUXE</title>
      <meta
        name="description"
        content="Every Little Luxe order — track parcels, reorder favourites and start a return."
      />
      <meta name="robots" content="noindex" />

      <DashboardPageHeader
        title="My Orders"
        emoji="📦"
        description="Track what's on the way, reorder the pieces they loved, or start a return — all in one place."
      />

      <OrdersExplorer />
    </>
  );
}
