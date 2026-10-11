"use client";

import { useLanguageStore } from "@/store/useLanguageStore";
import { SITE } from "@/lib/site";

export function ShopHeader() {
  const language = useLanguageStore((state) => state.language);
  const subtitle =
    language === "bn"
      ? "আপনার স্নিগ্ধ ছোটদের জন্য সুন্দর পোশাক ✨"
      : "Charming outfits for your precious little ones ✨";

  return (
    <header className="relative mx-auto w-full max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8 lg:pt-10">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
        <p className="text-xs font-semibold tracking-[0.3em] text-lavender uppercase">
          {SITE.kidsBrand}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Kids Collection
        </h1>
        <span
          aria-hidden
          className="mt-3 block h-1 w-20 rounded-full bg-linear-to-r from-primary via-rose to-lavender"
        />
        <p
          lang={language}
          className={`mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg ${
            language === "bn" ? "font-bengali" : ""
          }`}
        >
          {subtitle}
        </p>
      </div>
    </header>
  );
}
