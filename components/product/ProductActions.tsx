"use client";

import { useState } from "react";
import {
  Check,
  Heart,
  Minus,
  Plus,
  Ruler,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_HEX, DEFAULT_SWATCH, SIZE_CHART } from "@/lib/site";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/types";

interface ProductActionsProps {
  product: Product;
}

/**
 * Buy box: colour + size pickers, quantity, add-to-bag and wishlist.
 * Lives on the client because it writes to the cart store; the surrounding
 * product page stays a server component.
 */
export function ProductActions({ product }: ProductActionsProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isWishlisted = useWishlistStore((state) => state.ids.includes(product.id));
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  const [color, setColor] = useState(product.colors[0] ?? "");
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const maxQuantity = Math.max(1, Math.min(product.stock, 10));
  const isOneSize = product.sizes.length === 1 && product.sizes[0] === "One Size";

  const handleAdd = () => {
    addItem(product, quantity, { color, size });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Colour ---------- */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Colour
          </span>
          <span className="text-xs text-foreground/80">{color}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {product.colors.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              aria-label={`Colour ${option}`}
              aria-pressed={color === option}
              title={option}
              className={cn(
                "size-9 rounded-full border-2 transition-all duration-300 ease-[var(--ease-luxe)] hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                color === option
                  ? "border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                  : "border-white/20",
              )}
              style={{ backgroundColor: COLOR_HEX[option] ?? DEFAULT_SWATCH }}
            />
          ))}
        </div>
      </div>

      {/* ---------- Size ---------- */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Size
          </span>
          <button
            type="button"
            onClick={() => setSizeGuideOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-lavender underline-offset-4 transition-colors duration-300 hover:text-rose hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Ruler className="size-3.5" />
            Size Guide
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {product.sizes.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSize(option)}
              aria-pressed={size === option}
              className={cn(
                "min-w-12 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                size === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-glass-border bg-glass text-muted-foreground hover:border-rose/40 hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        {isOneSize && (
          <p className="mt-2 text-xs text-muted-foreground">
            One size fits most — ages {product.ageRange.replace("Y", "")}.
          </p>
        )}
      </div>

      {/* ---------- Quantity + CTA ---------- */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Qty
          </span>
          <div className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass p-1">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              disabled={quantity >= maxQuantity}
              aria-label="Increase quantity"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <span className="text-xs text-muted-foreground">
            {product.inStock
              ? product.stock <= 5
                ? `Only ${product.stock} left`
                : "In stock"
              : "Currently unavailable"}
          </span>
        </div>

        <Button
          type="button"
          onClick={handleAdd}
          disabled={!product.inStock}
          size="lg"
          className="h-14 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_44px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:scale-[1.02] motion-safe:hover:-translate-y-0.5"
        >
          {added ? (
            <>
              <Check className="size-4" />
              Added to bag
            </>
          ) : (
            <>
              <ShoppingBag className="size-4" />
              {product.inStock ? "Add to Cart" : "Out of stock"}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => toggleWishlist(product.id)}
          aria-pressed={isWishlisted}
          className={cn(
            "h-12 w-full gap-2 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-all duration-400 ease-[var(--ease-luxe)] hover:border-rose/50 hover:bg-rose-soft hover:text-rose",
            isWishlisted && "border-rose/50 text-rose",
          )}
        >
          <Heart className={cn("size-4", isWishlisted && "fill-rose")} />
          {isWishlisted ? "Saved to Wishlist" : "Add to Wishlist"}
        </Button>

        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-400" />
          Secure checkout · Gift wrapping available at checkout 🎁
        </p>
      </div>

      {/* ---------- Size guide ---------- */}
      <Dialog open={sizeGuideOpen} onOpenChange={setSizeGuideOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-glass-border bg-[#0c0c0c]/97 backdrop-blur-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="size-4 text-lavender" />
              Kids Size Guide
            </DialogTitle>
            <DialogDescription>
              Measurements are of the garment. Between sizes? We recommend sizing
              up — there is room to grow in every piece.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Kids clothing size chart with age, height, chest and waist
              </caption>
              <thead>
                <tr className="border-b border-glass-border text-left text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  <th scope="col" className="py-3 pr-4 font-medium">Size</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Age</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Height</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Chest</th>
                  <th scope="col" className="py-3 font-medium">Waist</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART.map((row) => (
                  <tr
                    key={row.size}
                    className="border-b border-glass-border/60 last:border-0"
                  >
                    <th
                      scope="row"
                      className="py-3 pr-4 text-left font-semibold text-primary"
                    >
                      {row.size}
                    </th>
                    <td className="py-3 pr-4 text-muted-foreground">{row.age}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.height}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.chest}</td>
                    <td className="py-3 text-muted-foreground">{row.waist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
