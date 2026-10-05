"use client";

import Link from "next/link";
import { ArrowLeft, Home, ShoppingBag } from "lucide-react";
import { NotFoundScene } from "@/components/layout/NotFoundScene";
import { useLanguageStore } from "@/store/useLanguageStore";

/** Suggested destinations — real routes, so the visitor has somewhere to go. */
const SUGGESTIONS = [
  { label: { en: "New Arrivals", bn: "নতুন আসন্ন" }, href: "/shop?sort=newest" },
  { label: { en: "Dresses", bn: "ড্রেস" }, href: "/shop?category=dresses" },
  { label: { en: "Shoes", bn: "জুতা" }, href: "/shop?category=shoes" },
  { label: { en: "Track an order", bn: "অর্ডার ট্র্যাক করুন" }, href: "/dashboard/orders" },
] as const;

export default function NotFound() {
  const language = useLanguageStore((state) => state.language);

  const titleText = language === "bn" ? "ওয়েবপেজ খুঁজে পাওয়া যায়নি" : "Page Not Found";
  const subtitleText =
    language === "bn"
      ? "ওই লিংকটি হারিয়ে গেছে। ভালো কিছু শুধু একটি ট্যাপ দূরত্বে — কালেকশন চেষ্টা করুন, অথবা দোকানের সামনে ফিরে যান।"
      : "That link has wandered off. The good stuff is only a tap away — try the collection, or head back to the front of the shop.";
  const goHomeText = language === "bn" ? "হোমে যান" : "Go Home";
  const shopText = language === "bn" ? "কালেকশন দেখুন" : "Shop the Collection";
  const suggestionsText = language === "bn" ? "আরও কিছু দেখুন:" : "More to explore:";
  const lostInText = language === "bn" ? "খেলার কক্ষে হারিয়ে গেছে" : "Lost in the playroom";

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.10)_0%,transparent_70%)]"
      />

      <NotFoundScene />

      <p className="relative mt-2 text-xs font-semibold tracking-[0.32em] text-primary uppercase">
        404 · {lostInText}
      </p>
      <h1 className="relative mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight text-gradient-gold sm:text-4xl">
        {titleText} <span aria-hidden>🧸</span>
      </h1>
      <p className="relative mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        {subtitleText}
      </p>

      <div className="relative mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:hover:scale-[1.02]"
        >
          <Home aria-hidden className="size-4" />
          {goHomeText}
        </Link>

        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-6 text-sm font-semibold text-foreground transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ShoppingBag aria-hidden className="size-4" />
          {shopText}
        </Link>
      </div>

      <p className="relative mt-10 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {suggestionsText}
      </p>
      <ul className="relative mt-2 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-glass-border bg-glass px-4 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden className="size-3 rotate-180" />
              {language === "bn" ? item.label.bn : item.label.en}
            </Link>
          </li>
        ))}
      </ul>

      {/* Print-friendly styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
