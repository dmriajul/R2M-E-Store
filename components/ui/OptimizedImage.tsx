"use client";

import { useState } from "react";
import Image from "next/image";
import { imageDeliveryProps, isRenderableImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * Rendition presets: the intrinsic box used when the image is not `fill`, and
 * a default `sizes` hint so the browser picks the right `srcset` candidate.
 */
export type ImagePreset = "thumbnail" | "card" | "detail" | "zoom" | "hero" | "blur";

export const IMAGE_PRESETS = {
  thumbnail: { width: 160, height: 160, sizes: "96px" },
  card: {
    width: 480,
    height: 600,
    sizes: "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw",
  },
  detail: { width: 960, height: 1200, sizes: "(min-width: 1024px) 45vw, 100vw" },
  zoom: { width: 1920, height: 2400, sizes: "(min-width: 1250px) 1200px, 96vw" },
  hero: { width: 1920, height: 1080, sizes: "100vw" },
  blur: { width: 40, height: 40, sizes: "40px" },
} as const;

export interface OptimizedImageProps {
  /**
   * Cloudinary URL, local `/…` path or any http(s) URL. Empty values and
   * legacy non-URL tokens render the fallback instead of a broken image.
   */
  src?: string | null;
  alt: string;
  /** Intrinsic size + default `sizes` (default `card`). */
  preset?: ImagePreset;
  /** Fill the (positioned) wrapper instead of using an intrinsic width/height. */
  fill?: boolean;
  width?: number;
  height?: number;
  /** Overrides the preset's `sizes` hint. */
  sizes?: string;
  /** Above-the-fold: eager load + high fetch priority (and a preload hint). */
  priority?: boolean;
  objectFit?: "cover" | "contain";
  /** Wrapper classes (size the wrapper; the image fills it). */
  className?: string;
  /** Classes for the `<img>` element itself. */
  imageClassName?: string;
  style?: React.CSSProperties;
  /** Rendered instead of the image when `src` is missing or fails to load. */
  fallback?: React.ReactNode;
  fallbackGradient?: string;
  fallbackEmoji?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Responsive image with Cloudinary delivery and graceful fallbacks.
 *
 * - **Cloudinary URLs** use a custom `next/image` loader, so every `srcset`
 *   candidate is a direct CDN URL with `f_auto,q_auto,w_{width},c_limit` —
 *   the browser receives AVIF/WebP at the width it needs, straight from
 *   Cloudinary (any transformation already in the stored URL is replaced, not
 *   stacked).
 * - **Other URLs** keep working: bundled `/public` files and allow-listed
 *   hosts go through the Next.js optimiser; runtime `/uploads/…` files and
 *   unknown hosts load as-is (`unoptimized`).
 * - Below-the-fold images are lazy (`loading="lazy"`); a pulse placeholder
 *   shows until the image has loaded, and load errors swap in the fallback.
 */
export function OptimizedImage({
  src,
  alt,
  preset = "card",
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  objectFit = "cover",
  className,
  imageClassName,
  style,
  fallback,
  fallbackGradient = "from-gray-700 to-gray-900",
  fallbackEmoji,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const presetConfig = IMAGE_PRESETS[preset];
  const renderable = isRenderableImage(src);

  if (!renderable || failedSrc === src) {
    if (fallback) {
      return (
        <div className={className} style={{ width, height, ...style }}>
          {fallback}
        </div>
      );
    }
    return (
      <div
        role="img"
        aria-label={alt || undefined}
        className={cn(
          "relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br",
          fallbackGradient,
          className,
        )}
        style={{ width, height, ...style }}
      >
        {fallbackEmoji && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
            {fallbackEmoji}
          </span>
        )}
      </div>
    );
  }

  const delivery = imageDeliveryProps(src);
  const dimensions = fill
    ? { fill: true as const }
    : { width: width ?? presetConfig.width, height: height ?? presetConfig.height };

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)} style={style}>
      {/* Placeholder sits *behind* the photo, never on top of it. The image is
          visible the moment it paints — no `opacity: 0` state to clear from
          JavaScript — so a failed hydration, a cached image whose `onLoad`
          never fires, or a slow chunk can never leave a tile blank. */}
      <div aria-hidden className="absolute inset-0 bg-gray-900/80" />

      <Image
        src={src}
        alt={alt}
        {...dimensions}
        sizes={sizes ?? presetConfig.sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        loader={delivery.loader}
        unoptimized={delivery.unoptimized}
        className={cn(
          !fill && "h-full w-full",
          objectFit === "contain" ? "object-contain" : "object-cover",
          imageClassName,
        )}
        onLoad={onLoad}
        onError={() => {
          setFailedSrc(src);
          onError?.();
        }}
      />
    </div>
  );
}

/** A tiny gradient SVG data URL, usable as a `blurDataURL` placeholder. */
export function generateBlurPlaceholder(): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%234B5563'/%3E%3Cstop offset='100%25' stop-color='%231F2937'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='40' height='40' fill='url(%23g)'/%3E%3C/svg%3E`;
}
