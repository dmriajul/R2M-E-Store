"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IMAGE_SIZES, imageSrc, isRenderableImage } from "@/lib/images";
import type { Product } from "@/types";

interface ProductArtworkProps {
  product: Product;
  /** Which photo to show (indexes into `product.images`). */
  index?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
  /** Artwork size for card, detail, and thumbnail contexts. */
  size?: "card" | "detail" | "thumb";
}

/**
 * Product photography with a restrained branded fallback when no valid image
 * is available or the remote image cannot be loaded.
 */
export function ProductArtwork({
  product,
  index = 0,
  alt,
  className,
  priority = false,
  size = "card",
}: ProductArtworkProps) {
  const candidate = product.images[index] ?? product.images[0];
  const [failedPhoto, setFailedPhoto] = useState<string | undefined>();
  const photo =
    isRenderableImage(candidate) && failedPhoto !== candidate
      ? candidate
      : undefined;

  if (photo) {
    return (
      <div className={cn("relative overflow-hidden bg-[#101010]", className)}>
        <Image
          src={imageSrc(photo, size === "thumb" ? 200 : 900)}
          alt={alt ?? product.name}
          fill
          sizes={IMAGE_SIZES[size]}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          // Local uploads are served directly; external CDNs serve their own
          // optimized image variants.
          unoptimized={photo.startsWith("/uploads/")}
          className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.04]"
          onError={() => setFailedPhoto(photo)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border border-[#D4AF37]/35 bg-[#111216]",
        className,
      )}
      role="img"
      aria-label={`${product.name} image unavailable`}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(212,175,55,0.12),transparent_58%),linear-gradient(145deg,#191a1e,#090a0d)]"
      />
      <span
        aria-hidden
        className="absolute inset-[6%] border border-[#D4AF37]/15"
      />
      <span
        aria-hidden
        className="absolute h-px w-1/3 bg-gradient-to-r from-transparent via-[#D4AF37]/55 to-transparent"
      />
      <span
        aria-hidden
        className="relative z-10 font-serif text-3xl font-light tracking-[0.3em] text-[#D4AF37]/70 sm:text-4xl"
      >
        M
      </span>
    </div>
  );
}
