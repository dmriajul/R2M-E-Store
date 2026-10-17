"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStockStatus } from "@/lib/dashboard-constants";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { ProductCard } from "@/components/product/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiResponse, Product } from "@/types";

function StockBadge({ product }: { product: Product }) {
  const status = getStockStatus(product.stock);

  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        status.className,
      )}
    >
      {status.label}
    </Badge>
  );
}

/**
 * One saved piece: the standard catalogue tile, a stock badge and the
 * "Move to Cart" shortcut. The heart on the tile removes it from the wishlist.
 */
function WishlistTile({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const removeFromWishlist = useWishlistStore((state) => state.remove);

  const moveToCart = () => {
    // `addItem` raises the "Added to bag! 🛍️" toast itself.
    addItem(product, 1);
    removeFromWishlist(product.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3"
    >
      <ProductCard product={product} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <StockBadge product={product} />
        <span className="text-xs text-muted-foreground">
          {product.inStock ? `${product.stock} left` : "Back soon"}
        </span>
      </div>

      {product.inStock ? (
        <Button
          type="button"
          onClick={moveToCart}
          className="h-11 w-full rounded-full bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_30px_-8px_rgba(212,175,55,0.9)]"
        >
          <ShoppingBag className="size-4" />
          Move to Cart
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast.info("We'll let you know 🧸", {
              description: `${product.name} is sold out — we can email you the moment it's back.`,
            })
          }
          className="h-11 w-full rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary"
        >
          Notify Me
        </Button>
      )}
    </motion.div>
  );
}

function SkeletonTile() {
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-4/5 w-full animate-pulse rounded-3xl border border-glass-border bg-white/5" />
      <div className="h-6 w-1/2 animate-pulse rounded-full bg-white/5" />
      <div className="h-11 w-full animate-pulse rounded-full bg-white/5" />
    </div>
  );
}

/**
 * Grid of saved pieces. Saved ids live in the wishlist store (persisted on the
 * device); the products themselves are resolved against the live catalogue via
 * `/api/products`, so a piece deleted from the store simply stops appearing.
 */
export function WishlistGrid() {
  const ids = useWishlistStore((state) => state.ids);
  const [catalogue, setCatalogue] = useState<Product[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<Product[]>;
        if (!active) return;
        if (!response.ok || !result.success || !result.data) throw new Error("unavailable");
        setCatalogue(result.data);
      })
      .catch(() => {
        if (active) setCatalogue([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const products = (catalogue ?? []).filter((product) => ids.includes(product.id));

  // While the catalogue loads (and during SSR) show placeholders rather than
  // flashing "your wishlist is empty" at a shopper who has saves.
  if (catalogue === null && ids.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <SkeletonTile key={key} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="glass-soft flex flex-col items-center gap-4 rounded-3xl border border-glass-border px-6 py-16 text-center">
        <span aria-hidden className="text-5xl">
          💝
        </span>
        <h2 className="text-xl font-bold">Your wishlist is empty! 💝</h2>
        <p className="prose-kids max-w-sm text-sm text-muted-foreground">
          Browse our adorable collection and save your favourites — they&apos;ll wait right here
          for you.
        </p>
        <Button
          asChild
          className="mt-1 h-12 rounded-full bg-primary px-7 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_32px_-8px_rgba(212,175,55,0.9)]"
        >
          <Link href="/shop">
            <ShoppingBag className="size-4" />
            Explore Collection
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {products.map((product) => (
          <WishlistTile key={product.id} product={product} />
        ))}
      </AnimatePresence>
    </div>
  );
}
