"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Languages, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import type { LegalContent, LegalLang } from "@/lib/legal-content";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Copy that only exists in the chrome (not part of the legal documents). */
interface LegalChrome {
  back: string;
  print: string;
  toggle: string;
  hint: string;
  updated: string;
}

const CHROME: Readonly<Record<LegalLang, LegalChrome>> = {
  en: {
    back: "Back to Home",
    print: "Print",
    toggle: "Language",
    hint: "Tap a heading to open it. Everything is written for parents, not lawyers.",
    updated: "Last updated",
  },
  bn: {
    back: "হোমে ফিরে যান",
    print: "প্রিন্ট",
    toggle: "ভাষা",
    hint: "যেকোনো শিরোনামে চাপ দিলে খুলে যাবে। সব লেখা বাবা-মায়ের জন্য সহজ ভাষায়।",
    updated: "সর্বশেষ হালনাগাদ",
  },
};

interface LegalPageProps {
  /** Both language variants of the document. */
  content: LegalContent;
  /** English page label — shown as the small gold eyebrow. */
  title: string;
  /** Localised "last updated" stamps. */
  lastUpdated: Record<LegalLang, string>;
}

/**
 * Shared shell for every legal/help page.
 *
 * The language toggle is pure `useState` — switching EN ⇄ বাংলা swaps the copy
 * instantly, with no navigation and no refetch. Sections collapse with
 * framer-motion; when printing, every section is forced open (and the controls
 * disappear) so the paper copy is complete.
 */
export function LegalPage({ content, title, lastUpdated }: LegalPageProps) {
  const [lang, setLang] = useState<LegalLang>("en");
  const doc = content[lang];
  const copy = CHROME[lang];
  const reducedMotion = usePrefersReducedMotion();
  const baseId = useId();

  /* Sections stay open independently — policies are read in chunks. */
  const [open, setOpen] = useState<string[]>(() => [content.en.sections[0]?.id ?? ""]);
  const toggle = (id: string) =>
    setOpen((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 print:py-0">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-glass-border bg-glass px-4 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase transition-all duration-300 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          {copy.back}
        </Link>

        <div className="flex items-center gap-2">
          {/* ---------- Language toggle ---------- */}
          <div
            role="group"
            aria-label={copy.toggle}
            className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass p-1 backdrop-blur-md"
          >
            <Languages aria-hidden className="mx-1 size-3.5 text-muted-foreground" />
            {(
              [
                { value: "en", label: "EN" },
                { value: "bn", label: "বাং" },
              ] as const
            ).map((option) => {
              const active = lang === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLang(option.value)}
                  aria-pressed={active}
                  lang={option.value}
                  className={cn(
                    "min-h-9 min-w-11 rounded-full px-3 text-xs font-bold tracking-wide transition-all duration-300 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_-8px_rgba(212,175,55,0.9)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:hover:scale-[1.02]"
          >
            <Printer aria-hidden className="size-3.5" />
            {copy.print}
          </button>
        </div>
      </div>

      {/* ---------- Heading ---------- */}
      <header className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-primary uppercase print:text-neutral-600">
          {title}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gradient-gold sm:text-4xl print:text-neutral-900">
          {doc.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base print:text-neutral-700">
          {doc.subtitle}
        </p>
        <p className="mt-3 text-xs text-muted-foreground/80 print:hidden">{copy.hint}</p>
      </header>

      {/* ---------- Sections ---------- */}
      <div className="mt-8 flex flex-col gap-3">
        {doc.sections.map((section, index) => {
          const isOpen = open.includes(section.id);
          const panelId = `${baseId}-${lang}-${section.id}`;

          return (
            <section
              key={section.id}
              className={cn(
                "overflow-hidden rounded-2xl border bg-glass backdrop-blur-md transition-colors duration-400 ease-[var(--ease-luxe)] print:bg-white print:break-inside-avoid",
                isOpen ? "border-primary/40" : "border-glass-border hover:border-primary/25",
              )}
            >
              <h2>
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors duration-300 ease-[var(--ease-luxe)] hover:bg-glass focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-5"
                >
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-xl border border-glass-border bg-[#141414] text-lg print:border-neutral-300 print:bg-white"
                  >
                    {section.icon}
                  </span>

                  <span className="flex-1 text-sm font-semibold text-foreground sm:text-base print:text-neutral-900">
                    {section.title}
                  </span>

                  {/* Section number — a quiet reading aid on long policies. */}
                  <span className="hidden text-[11px] tabular-nums text-muted-foreground/70 sm:inline print:hidden">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-400 ease-[var(--ease-luxe)] print:hidden",
                      isOpen && "rotate-180 text-primary",
                    )}
                  />
                </button>
              </h2>

              <motion.div
                id={panelId}
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                transition={
                  reducedMotion ? { duration: 0 } : { duration: 0.38, ease: EASE }
                }
                className="overflow-hidden print:h-auto! print:overflow-visible! print:opacity-100!"
              >
                <div className="flex flex-col gap-3 border-t border-glass-border px-4 py-4 sm:px-5 print:border-neutral-200">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-relaxed text-muted-foreground sm:text-[15px] print:text-neutral-800"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.div>
            </section>
          );
        })}
      </div>

      {/* ---------- Footer ---------- */}
      <footer className="mt-10 flex flex-col gap-2 border-t border-glass-border pt-6 print:border-neutral-300">
        <p className="text-xs text-muted-foreground print:text-neutral-700">
          {doc.footerNote}
        </p>
        <p className="text-xs text-muted-foreground/70 print:text-neutral-600">
          <span className="font-semibold">{copy.updated}:</span> {lastUpdated[lang]}
        </p>
      </footer>
    </div>
  );
}
