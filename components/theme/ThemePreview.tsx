"use client";

import type { ThemeColors } from "@/lib/theme-settings";
import { themeToCssVars } from "@/lib/theme-settings";

/**
 * Live storefront preview.
 *
 * Renders representative customer-facing elements (header/nav, hero, product
 * cards, buttons, category chips, footer) inside a wrapper that sets the
 * preview's CSS custom properties. Because the variables are scoped to this
 * wrapper, the preview reflects the administrator's in-progress colors without
 * touching the live storefront or the admin console chrome.
 *
 * The wrapper uses a fixed width with horizontal scroll on small screens so the
 * preview never reflows the settings form.
 */
export function ThemePreview({ colors }: { colors: ThemeColors }) {
  const vars = themeToCssVars(colors);

  return (
    <div
      className="theme-preview-scroll w-full overflow-x-auto rounded-xl border border-[#242424]"
      style={{ background: "var(--background)" }}
    >
      <div
        style={vars}
        className="min-w-[640px] bg-background text-foreground"
      >
        {/* ---- Header / nav ---- */}
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-semibold tracking-wide text-primary">
            MUKRA
          </span>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <span className="text-foreground">Shop</span>
            <span>Collections</span>
            <span>New</span>
            <span className="rounded-full bg-button-bg px-3 py-1 text-button-fg">
              Cart
            </span>
          </nav>
        </header>

        {/* ---- Hero ---- */}
        <section className="flex flex-col gap-3 px-5 py-8">
          <span className="w-20 rounded-full bg-accent/15 py-1 text-center text-[10px] font-medium text-accent">
            New Season
          </span>
          <h2 className="max-w-sm text-2xl font-bold leading-tight text-foreground">
            Where Magic Meets Style
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Premium kids fashion, crafted for little explorers.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              className="rounded-md bg-button-bg px-4 py-2 text-sm font-medium text-button-fg"
            >
              Shop Now
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
            >
              Explore
            </button>
          </div>
        </section>

        {/* ---- Category chips ---- */}
        <section className="flex flex-wrap gap-2 px-5">
          {["Tops", "Dresses", "Shoes", "Accessories"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground"
            >
              {label}
            </span>
          ))}
        </section>

        {/* ---- Product cards ---- */}
        <section className="grid grid-cols-3 gap-3 px-5 py-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface"
            >
              <div
                className="h-24"
                style={{
                  background:
                    i === 0
                      ? "var(--primary)"
                      : i === 1
                        ? "var(--accent)"
                        : "var(--secondary)",
                  opacity: 0.85,
                }}
              />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <span className="text-xs font-medium text-foreground">
                  Product {i + 1}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Adorable &amp; soft
                </span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-primary">
                    $24
                  </span>
                  <span className="rounded-md bg-button-bg px-2.5 py-1 text-[11px] font-medium text-button-fg">
                    Add
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ---- Footer ---- */}
        <footer className="border-t border-border px-5 py-4 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">MUKRA</span>
            <span>Premium kids fashion · Bangladesh</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
