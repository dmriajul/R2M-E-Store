"use client";

import { t } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

interface SectionHeadingProps {
  /** `t()` key for the small uppercase line above the title. */
  eyebrowKey: string;
  /** `t()` key for the heading itself. */
  titleKey: string;
  /** Optional `t()` key for the supporting paragraph. */
  descriptionKey?: string;
  /** Right-hand slot on desktop — e.g. a "View all" link. */
  action?: React.ReactNode;
  /** Heading level. Sections sit under the page `<h1>`, so `h2` is the default. */
  as?: "h2" | "h3";
  /** Anchor id, when the section doubles as an in-page scroll target. */
  id?: string;
}

/**
 * Shared heading block for the home page product sections.
 *
 * Client component on purpose — it reads the language store so the copy
 * follows the EN ⇄ BN toggle. It is deliberately *only* the heading: the
 * server components that own the data fetching render around it, so product
 * data never crosses into this component's props.
 */
export function SectionHeading({
  eyebrowKey,
  titleKey,
  descriptionKey,
  action,
  as: Heading = "h2",
  id,
}: SectionHeadingProps) {
  const language = useLanguageStore((state) => state.language);

  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
          {t(eyebrowKey, language)}
        </p>
        <Heading
          id={id}
          className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
        >
          {t(titleKey, language)}
        </Heading>
        <span
          aria-hidden
          className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
        />
      </div>

      {(descriptionKey || action) && (
        <div className="flex flex-col items-start gap-4 sm:items-end">
          {descriptionKey && (
            <p className="w-full max-w-sm text-sm leading-relaxed text-muted-foreground sm:w-auto">
              {t(descriptionKey, language)}
            </p>
          )}
          {action}
        </div>
      )}
    </header>
  );
}
