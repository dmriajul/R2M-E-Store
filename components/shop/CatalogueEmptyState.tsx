"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, t } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

type Variant = "default" | "compact" | "filter";

interface CatalogueEmptyStateProps {
  /**
   * `default` — the full premium panel used by the shop grid and product rails.
   * `compact` — the same voice in the space of a headless section.
   * `filter`  — no *products* match, but the catalogue is not empty; the CTA is
   *             "Clear filters" instead of the notify form.
   */
  variant?: Variant;
  /**
   * Why the panel is on screen.
   *
   *  • `empty` — the catalogue is reachable and simply has nothing in it yet;
   *  • `setup` — the store has no database configured yet (fresh deploy).
   *
   * Both are healthy states and both get this premium invitation; only a real
   * outage (`CatalogueUnavailable`) is allowed to show maintenance copy.
   */
  mode?: "empty" | "setup";
  /** Called by the filter variant's primary action. */
  onClearFilters?: () => void;
  /** Extra classes on the wrapping panel. */
  className?: string;
}

/**
 * Premium empty state for the catalogue.
 *
 * Rendered whenever the database answered and there is simply nothing to show —
 * never for a connection failure (that is `<CatalogueUnavailable />`). The
 * layout keeps the dark/gold language of the storefront: a glass panel, a gold
 * halo, a hairline rule and a purposeful call to action, so an unstocked store
 * still reads as intentional rather than broken.
 *
 * "Notify Me" is a real, self-contained capture: the storefront's newsletter
 * endpoint has not landed yet, so the form acknowledges the request locally and
 * explains what happens next. It never navigates away from the page the shopper
 * was browsing, and it works without JavaScript for the link-based actions.
 */
export function CatalogueEmptyState({
  variant = "default",
  mode = "empty",
  onClearFilters,
  className,
}: CatalogueEmptyStateProps) {
  const language = useLanguageStore((state) => state.language);
  const [email, setEmail] = useState("");
  const [notified, setNotified] = useState(false);

  const isFilter = variant === "filter";
  const isCompact = variant === "compact";
  const isSetup = mode === "setup" && !isFilter;

  const eyebrowKey = isFilter
    ? "sections.filterEmptyEyebrow"
    : isSetup
      ? "sections.databaseUnconfiguredEyebrow"
      : "sections.catalogueEmptyEyebrow";
  const titleKey = isFilter
    ? "sections.filterEmptyTitle"
    : isSetup
      ? "sections.databaseUnconfiguredTitle"
      : "sections.catalogueEmptyTitle";
  const descriptionKey = isFilter
    ? "sections.filterEmptyDescription"
    : isSetup
      ? "sections.databaseUnconfiguredDescription"
      : "sections.catalogueEmptyDescription";

  const handleNotify = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setNotified(true);
    setEmail("");
  };

  return (
    <div
      className={cn(
        "glass-soft relative isolate overflow-hidden rounded-3xl text-center",
        isCompact ? "px-6 py-12 sm:py-14" : "px-6 py-14 sm:px-10 sm:py-16",
        className,
      )}
    >
      {/* Gold halo + hairline rule — the same accents as the section headings. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.16)_0%,transparent_72%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />

      <div
        className={cn(
          "relative mx-auto flex w-full flex-col items-center",
          isCompact ? "max-w-md" : "max-w-xl",
        )}
      >
        {/* Emblem */}
        <span
          aria-hidden
          className="relative inline-flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_40px_-16px_rgba(212,175,55,0.9)]"
        >
          <Sparkles className="size-7" />
          <span className="absolute -top-1.5 -right-1.5 size-2 rounded-full bg-primary/70" />
          <span className="absolute -bottom-2 -left-1 size-1.5 rounded-full bg-primary/40" />
        </span>

        <p className="mt-6 text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">
          {t(eyebrowKey, language)}
        </p>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t(titleKey, language)}
        </h2>

        <span
          aria-hidden
          className="mt-4 block h-px w-16 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />

        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t(descriptionKey, language)}
        </p>

        {/* ---------- Actions ---------- */}
        {isFilter ? (
          <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={onClearFilters}
              className="h-11 w-full gap-2 rounded-full bg-primary px-7 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] sm:w-auto"
            >
              <ArrowRight aria-hidden className="size-4" />
              {t("sections.clearFilters", language)}
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full rounded-full border-glass-border bg-glass px-7 text-xs font-semibold tracking-[0.16em] text-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary sm:w-auto"
            >
              <Link href="/">{t("sections.backToHome", language)}</Link>
            </Button>
          </div>
        ) : notified ? (
          <div
            role="status"
            className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-primary/35 bg-primary/10 px-5 py-3 text-sm text-foreground"
          >
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check aria-hidden className="size-3.5" />
            </span>
            You&apos;re on the list — we&apos;ll write the moment the collection lands.
          </div>
        ) : (
          <form
            onSubmit={handleNotify}
            className="mt-8 w-full max-w-md"
            aria-label="Get notified when the collection arrives"
          >
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <label htmlFor="catalogue-empty-email" className="sr-only">
                Email address
              </label>
              <Input
                id="catalogue-empty-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                className="h-11 flex-1 border-glass-border bg-black/30 text-sm backdrop-blur-md transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/30"
              />
              <Button
                type="submit"
                className="h-11 shrink-0 gap-2 rounded-full bg-primary px-6 text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)]"
              >
                <Bell aria-hidden className="size-4" />
                {t("sections.catalogueEmptyCta", language)}
              </Button>
            </div>
          </form>
        )}

        {!isFilter && (
          <Link
            href="/#collections"
            className="group mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("sections.catalogueEmptySecondaryCta", language)}
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        )}

        <p className="mt-8 text-[10px] leading-relaxed tracking-[0.18em] text-muted-foreground/70 uppercase">
          {t("sections.catalogueEmptyPerks", language)}
        </p>
      </div>
    </div>
  );
}
