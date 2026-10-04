"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, PenLine, Star } from "lucide-react";
import { MOCK_REVIEWS } from "@/lib/site";
import { StarRating } from "@/components/product/StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/types";

interface ReviewSectionProps {
  product: Product;
}

/** Star distribution used for the breakdown bars, weighted to the product rating. */
function buildBreakdown(rating: number, reviewCount: number): Array<{ stars: number; count: number }> {
  const weights = [
    Math.min(1, Math.max(0, (rating - 3.6) / 1.4) * 0.9 + 0.05),
    0.18,
    Math.max(0, (4.4 - rating) * 0.12),
    Math.max(0, (4.4 - rating) * 0.08),
    Math.max(0, (4.4 - rating) * 0.05),
  ];
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return weights.map((weight, index) => ({
    stars: 5 - index,
    count: Math.round((weight / total) * reviewCount),
  }));
}

/**
 * Reviews block: average, distribution bars, the three mock parent reviews and
 * a (UI-only) "Write a Review" dialog.
 */
export function ReviewSection({ product }: ReviewSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const breakdown = buildBreakdown(product.rating, product.reviewCount);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Reviews post to the backend in a later step.
    setSubmitted(true);
    window.setTimeout(() => {
      setSubmitted(false);
      setDialogOpen(false);
    }, 1400);
  };

  return (
    <section id="reviews" className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-lavender uppercase">
            Reviews
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Loved by parents 💬
          </h2>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          variant="outline"
          className="h-11 gap-2 rounded-full border-glass-border bg-glass px-6 text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary"
        >
          <PenLine className="size-3.5" />
          Write a Review
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* ---------- Summary ---------- */}
        <div className="glass-soft flex flex-col gap-5 rounded-3xl p-6">
          <div className="flex items-end gap-3">
            <span className="text-5xl font-bold text-gradient-gold">
              {product.rating.toFixed(1)}
            </span>
            <div className="pb-1">
              <StarRating rating={product.rating} size="md" />
              <p className="mt-1 text-xs text-muted-foreground">
                {product.reviewCount} verified reviews
              </p>
            </div>
          </div>

          <Separator className="bg-glass-border" />

          <ul className="flex flex-col gap-2.5">
            {breakdown.map((row) => {
              const percent =
                product.reviewCount > 0
                  ? Math.round((row.count / product.reviewCount) * 100)
                  : 0;

              return (
                <li key={row.stars} className="flex items-center gap-3">
                  <span className="flex w-10 shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {row.stars}
                    <Star className="size-3 text-primary" fill="currentColor" />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                    <span
                      className="block h-full rounded-full bg-linear-to-r from-primary to-rose"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {row.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---------- Review list ---------- */}
        <ul className="flex flex-col gap-4">
          {MOCK_REVIEWS.map((review) => (
            <li
              key={review.id}
              className="glass-soft rounded-3xl border border-glass-border p-5 transition-colors duration-400 hover:border-rose/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-full bg-linear-to-br from-lavender/30 to-rose/30 text-sm font-bold text-white"
                  >
                    {review.author.charAt(0)}
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {review.author}
                      {review.verified && (
                        <BadgeCheck
                          className="size-3.5 text-primary"
                          aria-label="Verified purchase"
                        />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {review.location} · {review.date}
                    </p>
                  </div>
                </div>
                <StarRating rating={review.rating} size="sm" />
              </div>

              <h3 className="mt-4 text-sm font-semibold">{review.title}</h3>
              <p className="prose-kids mt-1.5 text-sm text-muted-foreground">
                {review.body}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- Write a review ---------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-glass-border bg-[#0c0c0c]/97 backdrop-blur-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>
              Tell other parents how {product.name} held up. Reviews are moderated
              before publishing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="review-name" className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                Your name
              </label>
              <Input
                id="review-name"
                required
                placeholder="e.g. Alex P."
                className="h-11 border-glass-border bg-black/30 focus-visible:border-primary/60"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                Rating
              </span>
              <div className="flex items-center gap-1" role="img" aria-label="Five star rating selector">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    className="size-6 text-primary"
                    fill="currentColor"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="review-body" className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                Your review
              </label>
              <textarea
                id="review-body"
                required
                rows={4}
                placeholder="How did it fit? How has it washed?"
                className="prose-kids w-full rounded-2xl border border-glass-border bg-black/30 px-3.5 py-3 text-sm text-foreground outline-none transition-colors duration-300 placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-primary/25"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-11 rounded-full border-glass-border bg-glass text-xs tracking-[0.16em] uppercase"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-full bg-primary px-6 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase"
              >
                {submitted ? "Thank you!" : "Submit review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
