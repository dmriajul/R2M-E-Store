import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** 0–5, may be fractional. */
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-5",
} as const;

/**
 * Fractional star display. Each star is an outlined base with a filled copy
 * clipped to the fractional width, so 4.6 reads as four-and-a-bit stars.
 */
export function StarRating({
  rating,
  reviewCount,
  size = "md",
  className,
}: StarRatingProps) {
  const starClass = cn(SIZES[size], "shrink-0");

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="inline-flex items-center gap-0.5"
        role="img"
        aria-label={`Rated ${rating.toFixed(1)} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const fill = Math.min(Math.max(rating - index, 0), 1) * 100;

          return (
            <span key={index} className="relative inline-block">
              <Star className={cn(starClass, "text-muted-foreground/35")} />
              <span
                aria-hidden
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill}%` }}
              >
                <Star className={cn(starClass, "text-primary")} fill="currentColor" />
              </span>
            </span>
          );
        })}
      </span>

      {typeof reviewCount === "number" && (
        <span className="text-xs text-muted-foreground">
          ({reviewCount})
        </span>
      )}
    </span>
  );
}
