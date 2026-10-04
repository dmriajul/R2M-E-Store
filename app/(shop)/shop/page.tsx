import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse the full LUXE collection of timepieces, fragrance, leather and sound.",
};

export default function ShopPage() {
  return (
    <PagePlaceholder
      eyebrow="Catalogue"
      title="Shop"
      description="Filtering, sorting and the product grid are wired up in the next step. The mock catalogue in lib/site.ts already matches the Product type."
      path="app/(shop)/shop/page.tsx"
    />
  );
}
