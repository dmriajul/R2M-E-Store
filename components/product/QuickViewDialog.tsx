"use client";

import Link from "next/link";
import { ArrowUpRight, Plus, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { BADGE_STYLES, CATEGORY_META, GENDER_EMOJI } from "@/lib/site";
import { useCartStore } from "@/store/useCartStore";
import { useState } from "react";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { StarRating } from "@/components/product/StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/types";

interface QuickViewDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Compact preview reached from a product tile's hover overlay. */
export function QuickViewDialog({
  product,
  open,
  onOpenChange,
}: QuickViewDialogProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);
  const meta = CATEGORY_META[product.category];

  const handleAdd = () => {
    addItem(product, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-glass-border bg-[#0d0d0d]/95 p-0 backdrop-blur-2xl sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            Quick view of {product.name} for ages {product.ageRange}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2">
          <div className="relative">
            <ProductArtwork product={product} className="h-52 sm:h-full" />
            {product.badge && (
              <Badge
                className={`absolute top-4 left-4 border text-[10px] font-bold tracking-wider uppercase ${BADGE_STYLES[product.badge]}`}
              >
                {product.badge}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-4 p-6">
            <div>
              <p className="text-[11px] tracking-[0.24em] text-lavender uppercase">
                {meta.emoji} {product.category}
              </p>
              <h3 className="mt-2 text-xl font-bold tracking-tight">
                {product.name}
              </h3>
              <p className="prose-kids mt-2 text-sm text-muted-foreground">
                {product.tagline}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <StarRating rating={product.rating} reviewCount={product.reviewCount} />
              <span className="text-xs text-muted-foreground">
                {GENDER_EMOJI[product.gender]} {product.gender}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">
                {formatPrice(product.price, product.currency)}
              </span>
              {product.originalPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.originalPrice, product.currency)}
                </span>
              )}
              <span className="ml-auto rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-muted-foreground">
                Ages {product.ageRange.replace("Y", "")}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {product.colors.map((color) => (
                <span
                  key={color}
                  className="rounded-full border border-glass-border bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {color}
                </span>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!product.inStock}
                className="h-11 w-full gap-2 rounded-full bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_28px_-6px_rgba(212,175,55,0.9)] motion-safe:hover:scale-[1.02]"
              >
                {added ? (
                  <>
                    <Check className="size-4" /> Added to bag
                  </>
                ) : product.inStock ? (
                  <>
                    <Plus className="size-4" /> Add to Cart
                  </>
                ) : (
                  "Out of stock"
                )}
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-10 w-full gap-2 rounded-full text-xs tracking-[0.16em] text-lavender uppercase transition-colors duration-300 hover:bg-lavender-soft hover:text-lavender"
              >
                <Link href={`/product/${product.id}`}>
                  Full details
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
