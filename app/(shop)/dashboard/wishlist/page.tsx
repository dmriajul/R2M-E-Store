"use client";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { WishlistGrid } from "@/components/dashboard/WishlistGrid";
import { useWishlistStore } from "@/store/useWishlistStore";

export default function DashboardWishlistPage() {
  const count = useWishlistStore((state) => state.ids.length);

  return (
    <>
      <title>My Wishlist | MUKRA</title>
      <meta
        name="description"
        content="Your saved Mukra pieces — move them to the bag whenever you're ready."
      />
      <meta name="robots" content="noindex" />

      <DashboardPageHeader
        title="My Wishlist"
        emoji="🧸"
        description={`${count} ${count === 1 ? "piece" : "pieces"} saved for later. Tap the heart to remove, or move a piece straight into your bag.`}
      />

      <WishlistGrid />
    </>
  );
}
