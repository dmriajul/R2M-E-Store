"use client";

import { useState } from "react";
import Image, { type ImageLoader } from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { isRenderableImage } from "@/lib/images";
import {
  IMAGE_PRESETS_KEYS,
  PRESET_SIZES,
  cloudinaryUrl,
  getBlurDataUrl,
  getOptimizedUrl,
  isCloudinaryUrl,
  type ImagePreset,
} from "@/lib/image-optimizer";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/* -------------------------------------------------------------------------- */
/*  Loaders                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `next/image` asks the loader for one URL per width in the `srcSet` it
 * generates, so Cloudinary assets get a properly transformed candidate for each
 * breakpoint — and everything else falls through unchanged.
 */
const LOADERS: Readonly<Record<ImagePreset, ImageLoader>> = Object.fromEntries(
  IMAGE_PRESETS_KEYS.map((preset) => [
    preset,
    ({ src, width }: { src: string; width: number }) =>
      isCloudinaryUrl(src) ? cloudinaryUrl(src, preset, width) : src,
  ]),
) as Readonly<Record<ImagePreset, ImageLoader>>;

/** Soft shimmer sweep used while a photo is still in flight. */
const SHIMMER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.02) 100%)",
  backgroundSize: "200% 100%",
};

export interface OptimizedImageProps {
  /** Photo URL. Placeholder tokens ("floral-summer-dress-1") render the fallback. */
  src?: string;
  alt: string;
  preset?: ImagePreset;
  /** Overrides the preset's default `sizes` attribute. */
  sizes?: string;
  /** Classes for the positioned wrapper — put your aspect ratio here. */
  className?: string;
  /** Extra classes for the `<Image>` itself (hover zoom, object position…). */
  imageClassName?: string;
  priority?: boolean;
  quality?: number;
  /** Skip Next's optimiser (used for `/uploads/…` files we already sized). */
  unoptimized?: boolean;
  /** Custom tile for the no-photo case; defaults to a gradient + emoji. */
  fallback?: React.ReactNode;
  /** Emoji for the built-in gradient fallback tile. */
  fallbackEmoji?: string;
}

/**
 * The storefront's single image primitive.
 *
 * - real photos render through `next/image` with a responsive `srcSet`,
 * - Cloudinary assets get `f_auto,q_auto` crops per breakpoint,
 * - a blurred 24px preview fades in behind the photo (blur placeholder),
 * - a shimmer keeps the frame alive while loading,
 * - placeholder tokens / broken URLs fall back to a gradient tile, never blank.
 */
export function OptimizedImage({
  src,
  alt,
  preset = "card",
  sizes,
  className,
  imageClassName,
  priority = false,
  quality = 82,
  unoptimized,
  fallback,
  fallbackEmoji = "🧸",
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const renderable = isRenderableImage(src) && !failed;
  const placeholder = renderable && src ? getBlurDataUrl(src) : undefined;

  /* ---------- No photo (or the photo 404'd): gradient tile ---------- */
  if (!renderable || !src) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden",
          className,
        )}
      >
        {fallback ?? (
          <>
            <span
              aria-hidden
              className="absolute inset-0 bg-linear-to-br from-[#2a2438] via-[#1b1b24] to-[#0f0f12]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_115%,rgba(10,10,10,0.85)_0%,rgba(10,10,10,0.3)_50%,transparent_78%)]"
            />
            <span
              aria-hidden
              className="emoji-pop relative z-10 text-5xl drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)] sm:text-6xl"
            >
              {fallbackEmoji}
            </span>
          </>
        )}
      </div>
    );
  }

  const localFile = src.startsWith("/uploads/");

  return (
    <div className={cn("relative overflow-hidden bg-[#0d0d0d]", className)}>
      {/* ---------- Blur placeholder (Cloudinary only) ---------- */}
      {placeholder && !loaded && (
        <span
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
          style={{ backgroundImage: `url(${placeholder})` }}
        />
      )}

      {/* ---------- Shimmer ---------- */}
      <AnimatePresence>
        {!loaded && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: reducedMotion ? 0.35 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.2 : 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-10 overflow-hidden"
          >
            <span aria-hidden className="animate-shimmer absolute inset-0" style={SHIMMER_STYLE} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* ---------- The photo ---------- */}
      <motion.span
        initial={false}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
      >
        <Image
          src={getOptimizedUrl(src, preset)}
          alt={alt}
          fill
          sizes={sizes ?? PRESET_SIZES[preset]}
          loader={isCloudinaryUrl(src) ? LOADERS[preset] : undefined}
          quality={quality}
          priority={priority}
          unoptimized={unoptimized ?? localFile}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("object-cover", imageClassName)}
        />
      </motion.span>
    </div>
  );
}
