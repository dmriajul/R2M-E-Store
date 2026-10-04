"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Box, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_STYLES } from "@/lib/site";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ProductViewerFallback } from "@/components/three/ProductViewerFallback";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types";

/** WebGL cannot be server-rendered — load the viewer lazily on the client. */
const ProductViewer = dynamic(() => import("@/components/three/ProductViewer"), {
  ssr: false,
  loading: () => <ProductViewerFallback />,
});

type Tab = "3d" | "images";

interface ProductGalleryProps {
  product: Product;
}

/**
 * Left column of the product page: a "3D View" / "Images" toggle over either the
 * WebGL viewer or the gradient placeholder gallery.
 */
export function ProductGallery({ product }: ProductGalleryProps) {
  const [tab, setTab] = useState<Tab>("3d");
  const [activeImage, setActiveImage] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Tab toggle ---------- */}
      <div
        role="tablist"
        aria-label="Product media"
        className="flex w-fit items-center gap-1 rounded-full border border-glass-border bg-glass p-1 backdrop-blur-md"
      >
        {(
          [
            { value: "3d", label: "3D View", icon: Box },
            { value: "images", label: "Images", icon: Images },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase transition-all duration-400 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              tab === value
                ? "bg-primary text-primary-foreground shadow-[0_0_24px_-8px_rgba(212,175,55,0.9)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ---------- Media ---------- */}
      <div className="relative">
        {tab === "3d" ? (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
            <ProductViewer
              category={product.category}
              color={product.modelColor}
              productName={product.name}
            />
          </div>
        ) : (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
            <OptimizedImage
              src={product.images[activeImage] ?? product.images[0]}
              alt={`${product.name} — image ${activeImage + 1}`}
              preset="detail"
              className="aspect-square w-full rounded-3xl border border-glass-border"
              /* Placeholder products keep their gradient tile. */
              fallback={
                <ProductArtwork
                  product={product}
                  index={activeImage}
                  size="detail"
                  className="aspect-square w-full rounded-3xl border border-glass-border"
                />
              }
            />

            {/* Thumbnail strip */}
            <div className="mt-4 grid grid-cols-4 gap-3">
              {product.images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`View image ${index + 1} of ${product.images.length}`}
                  aria-pressed={activeImage === index}
                  className={cn(
                    "overflow-hidden rounded-2xl border transition-all duration-400 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    activeImage === index
                      ? "border-primary/70 shadow-[0_0_24px_-10px_rgba(212,175,55,0.9)]"
                      : "border-glass-border opacity-70 hover:opacity-100",
                  )}
                >
                  <OptimizedImage
                    src={image}
                    /* Decorative: the button above already carries the label. */
                    alt=""
                    preset="thumbnail"
                    className="aspect-square w-full"
                    fallback={
                      <ProductArtwork
                        product={product}
                        index={index}
                        size="thumb"
                        className="aspect-square w-full"
                      />
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {product.badge && (
          <Badge
            className={cn(
              "absolute top-4 left-4 border text-[10px] font-bold tracking-wider uppercase backdrop-blur-md",
              BADGE_STYLES[product.badge],
            )}
          >
            {product.badge}
          </Badge>
        )}
      </div>
    </div>
  );
}
