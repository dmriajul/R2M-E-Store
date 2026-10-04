import Image from "next/image";
import { cn } from "@/lib/utils";
import { CATEGORY_META, COLOR_HEX, DEFAULT_SWATCH } from "@/lib/site";
import { IMAGE_SIZES, imageSrc, isRenderableImage } from "@/lib/images";
import type { Product } from "@/types";

interface ProductArtworkProps {
  product: Product;
  /** Which placeholder tile to show (indexes into `product.images`). */
  index?: number;
  className?: string;
  /** Larger emoji + softer overlay for hero-sized artwork. */
  size?: "card" | "detail" | "thumb";
}

const EMOJI_SIZE = {
  card: "text-6xl sm:text-7xl",
  detail: "text-8xl sm:text-9xl",
  thumb: "text-2xl",
} as const;

/**
 * Placeholder artwork: there are no product photographs in this build, so each
 * tile is a category gradient with the category emoji and a soft glow built
 * from the product's own palette.
 */
export function ProductArtwork({
  product,
  index = 0,
  className,
  size = "card",
}: ProductArtworkProps) {
  const meta = CATEGORY_META[product.category];
  const swatch =
    COLOR_HEX[product.colors[index % product.colors.length] ?? ""] ?? DEFAULT_SWATCH;

  /* A real photograph (Cloudinary or /public/uploads) always wins the slot. */
  const candidate = product.images[index] ?? product.images[0];
  const photo = isRenderableImage(candidate) ? candidate : undefined;

  if (photo) {
    return (
      <div className={cn("relative overflow-hidden bg-[#101010]", className)}>
        <Image
          src={imageSrc(photo, size === "thumb" ? 200 : 900)}
          alt={product.name}
          fill
          sizes={IMAGE_SIZES[size]}
          // Local /public/uploads files are already exactly what we want;
          // Cloudinary serves an optimised, auto-format URL.
          unoptimized={photo.startsWith("/uploads/")}
          className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.04]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {/* Category gradient wash */}
      <span
        aria-hidden
        className={cn("absolute inset-0 bg-linear-to-br opacity-90", meta.gradient)}
      />
      {/* Deepening layer keeps the emoji legible and the card premium */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_110%,rgba(10,10,10,0.85)_0%,rgba(10,10,10,0.35)_45%,transparent_75%)]"
      />
      {/* Palette glow tied to the product's first colours */}
      <span
        aria-hidden
        className="absolute -top-10 -right-8 size-32 rounded-full opacity-45 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ backgroundColor: swatch }}
      />

      <span
        aria-hidden
        className={cn(
          "emoji-pop relative z-10 drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]",
          EMOJI_SIZE[size],
        )}
      >
        {meta.emoji}
      </span>
    </div>
  );
}
