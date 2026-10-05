"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Responsive Cloudinary image presets.
 */
export type ImagePreset = "thumbnail" | "card" | "detail" | "zoom" | "blur";

export const IMAGE_PRESETS = {
  thumbnail: { width: 100, height: 100, quality: 70 },
  card: { width: 400, height: 500, quality: 80 },
  detail: { width: 800, height: 1000, quality: 85 },
  zoom: { width: 1600, height: 2000, quality: 90 },
  blur: { width: 40, height: 40, quality: 10 },
} as const;

interface OptimizedImageProps {
  src?: string | null;
  alt: string;
  preset?: ImagePreset;
  className?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  fallbackGradient?: string;
  fallbackEmoji?: string;
  priority?: boolean;
  sizes?: string;
  onError?: () => void;
  fallback?: React.ReactNode;
}

/**
 * Optimized image component with Cloudinary integration and CSS gradient
 * placeholder fallback when images are absent or fail to load.
 */
export function OptimizedImage({
  src,
  alt,
  preset = "card",
  className,
  width,
  height,
  style,
  fallbackGradient = "from-gray-700 to-gray-900",
  fallbackEmoji,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  onError,
  fallback,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  const presetConfig = IMAGE_PRESETS[preset];
  const placeholderWidth = presetConfig.width;
  const placeholderHeight = presetConfig.height;

  const cloudinaryUrl = src ? buildCloudinaryUrl(src, preset) : null;

  // Handle image load errors
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const handleError = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };

    const handleLoad = () => {
      setIsLoading(false);
    };

    img.addEventListener("error", handleError);
    img.addEventListener("load", handleLoad);

    return () => {
      img.removeEventListener("error", handleError);
      img.removeEventListener("load", handleLoad);
    };
  }, [onError]);

  const fallbackClass = cn(
    "relative overflow-hidden rounded-lg bg-gradient-to-br",
    fallbackGradient,
    "aspect-square",
  );

  if (!src || hasError) {
    if (fallback) {
      return (
        <div
          className={cn("", className)}
          style={{ width: width, height: height, ...style }}
        >
          {fallback}
        </div>
      );
    }
    return (
      <div
        className={cn(fallbackClass, className)}
        style={{ width: width, height: height, ...style }}
        aria-label={alt}
      >
        {fallbackEmoji && (
          <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
            {fallbackEmoji}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)} style={style}>
      {/* Blur placeholder */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-900 animate-pulse"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      <Image
        ref={imgRef}
        src={cloudinaryUrl ?? src}
        alt={alt}
        width={width ?? placeholderWidth}
        height={height ?? placeholderHeight}
        className={cn(
          "object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
        )}
        priority={priority}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
      />
    </div>
  );
}

/**
 * Build a Cloudinary transformation URL for the given preset.
 * If Cloudinary is not configured, return the original URL.
 */
function buildCloudinaryUrl(
  imageId: string,
  preset: ImagePreset,
  options?: {
    effect?: string;
    overlay?: string;
    opacity?: number;
  },
): string {
  const config = IMAGE_PRESETS[preset];
  const { width, height, quality } = config;

  // Check if we're using Cloudinary
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const useCloudinary = cloudName && cloudName.trim().length > 0;

  if (!useCloudinary) {
    // Return as-is (local or CDN URL)
    return imageId;
  }

  // Build Cloudinary URL with transformations
  const transformations = [
    `w_${width}`,
    `h_${height}`,
    `c_fill`,
    `q_${quality}`,
    "f_auto",
  ];

  if (options?.effect) {
    transformations.push(options.effect);
  }

  const transformString = transformations.join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${imageId}`;
}

/**
 * Generate a blur placeholder data URL for lazy loading.
 */
export function generateBlurPlaceholder(
  _gradient?: string,
): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%234B5563'/%3E%3Cstop offset='100%25' stop-color='%231F2937'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='40' height='40' fill='url(%23g)'/%3E%3C/svg%3E`;
}
