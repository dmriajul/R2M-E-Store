"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

/**
 * Premium empty state for product sections on the home page.
 *
 * Shown when the database is reachable but the catalogue is still empty —
 * the hero, banners and features band keep their full layout; only the
 * product grid/rail collapses into this invitation. (When the database is
 * unreachable the page renders the `CatalogueUnavailable` maintenance
 * notice instead and the product sections stay out of the way entirely.)
 */
export function CatalogueEmptyState() {
  const language = useLanguageStore((state) => state.language);

  return (
    <div className="glass-soft relative mt-12 flex flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.14)_0%,transparent_70%)]"
      />
      <span
        aria-hidden
        className="relative inline-flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"
      >
        <Sparkles className="size-6" />
      </span>
      <h3 className="relative text-xl font-semibold tracking-tight">
        {t("sections.emptyTitle", language)}
      </h3>
      <p className="relative max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("sections.emptyDescription", language)}
      </p>
      <Button
        asChild
        className="relative mt-2 h-11 rounded-full bg-primary px-7 text-sm font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)]"
      >
        <Link href="/shop">{t("sections.browseCollection", language)}</Link>
      </Button>
    </div>
  );
}
