"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn, t } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

interface CatalogueUnavailableProps {
  /**
   * `page`    — full-width notice on /shop and /collections.
   * `section` — compact notice used in place of a home-page product section.
   */
  variant?: "page" | "section";
  className?: string;
}

/**
 * The *only* maintenance surface in the catalogue.
 *
 * Rendered exclusively when a database **is** configured but the read failed
 * (`CatalogueStatus === "unavailable"`). An empty-but-reachable catalogue gets
 * the premium `<CatalogueEmptyState />` instead, and an unconfigured deployment
 * is treated as "opening soon" — never as an error. This is what keeps
 * "We'll be right back" meaning what it says.
 */
export function CatalogueUnavailable({
  variant = "page",
  className,
}: CatalogueUnavailableProps) {
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const [retrying, setRetrying] = useState(false);
  const isSection = variant === "section";


  const retry = useCallback(() => {
    setRetrying(true);
    router.refresh();
  }, [router]);

  // The refresh has landed when this component re-renders with data; until
  // then keep the button honest with a short-lived busy label.
  useEffect(() => {
    if (!retrying) return;
    const timer = window.setTimeout(() => setRetrying(false), 4000);
    return () => window.clearTimeout(timer);
  }, [retrying]);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20",
        className,
      )}
    >
      <div
        className={cn(
          "glass-soft relative mx-auto overflow-hidden rounded-3xl text-center",
          isSection ? "max-w-2xl p-8 sm:p-10" : "max-w-3xl p-8 sm:p-12",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.14)_0%,transparent_70%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />

        <span
          aria-hidden
          className="relative inline-flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"
        >
          <WifiOff className="size-6" />
        </span>

        <h2 className="relative mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("sections.databaseUnavailableTitle", language)}
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("sections.databaseUnavailableDescription", language)}
        </p>

        <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            aria-busy={retrying}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-80 sm:w-auto"
          >
            <RefreshCw
              aria-hidden
              className={cn("size-4", retrying && "motion-safe:animate-spin")}
            />
            {retrying ? "Retrying…" : t("sections.databaseUnavailableCta", language)}
          </button>
          <a
            href="/contact"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-glass-border bg-glass px-6 text-sm font-semibold text-foreground transition-colors duration-500 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-auto"
          >
            Contact us
          </a>
        </div>
      </div>
    </div>
  );
}
