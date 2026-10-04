"use client";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { WishlistGrid } from "@/components/dashboard/WishlistGrid";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useWishlistStore } from "@/store/useWishlistStore";

export default function DashboardWishlistPage() {
  const seeded = useDashboardStore((state) => state.wishlistSeeded);
  const count = useWishlistStore((state) => state.ids.length);

  return (
    <>
      <title>My Wishlist | LITTLE LUXE</title>
      <meta
        name="description"
        content="Your saved Little Luxe pieces — move them to the bag whenever you're ready."
      />
      <meta name="robots" content="noindex" />

      <DashboardPageHeader
        title="My Wishlist"
        emoji="🧸"
        description={
          seeded
            ? `${count} ${count === 1 ? "piece" : "pieces"} saved for later. Tap the heart to remove, or move a piece straight into your bag.`
            : "Fetching your favourites…"
        }
      />

      <WishlistGrid />
    </>
  );
}
