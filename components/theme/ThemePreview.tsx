"use client";

import type { DesignConfig, ThemeColors } from "@/lib/theme-settings";
import { themeToCssVars } from "@/lib/theme-settings";

interface ThemePreviewProps {
  colors: ThemeColors;
  design: DesignConfig;
}

/**
 * Live storefront preview.
 *
 * Renders a representative customer-facing storefront (header/nav, hero with
 * preset typography, buttons, product cards, layout/spacing, footer) inside a
 * wrapper that sets the preset's full CSS custom properties. Because the
 * variables are scoped to this wrapper, the preview reflects the administrator's
 * in-progress design without touching the live storefront or the admin console
 * chrome.
 *
 * It reuses the same `.theme-*` component classes and design tokens the real
 * storefront uses, so the preview matches the actual rendered design system.
 *
 * The wrapper uses a fixed width with horizontal scroll on small screens so the
 * preview never reflows the settings form.
 */
export function ThemePreview({ colors, design }: ThemePreviewProps) {
  const vars = themeToCssVars(colors, design);

  return (
    <div
      className="theme-preview-scroll w-full overflow-x-auto rounded-xl border border-[#242424]"
      style={{ background: "var(--background)" }}
    >
      <div
        style={vars}
        className="theme-body min-w-[680px] bg-background text-foreground"
      >
        {/* ---- Header / nav ---- */}
        <header
          className={`theme-header theme-header-border sticky top-0 z-10 w-full border-b ${
            design.header.borderStyle === "shadow" ? "theme-header-shadow" : ""
          }`}
        >
          <div className="theme-container theme-page-pad flex h-16 items-center justify-between">
            <span className="theme-heading text-sm font-semibold tracking-wide text-primary">
              MUKRA
            </span>
            <nav
              className="flex items-center gap-8"
              style={{ gap: design.header.navSpacing }}
            >
              <span className="theme-nav-link text-foreground">Shop</span>
              <span className="theme-nav-link text-muted-foreground">
                Collections
              </span>
              <span className="theme-nav-link text-muted-foreground">New</span>
              <span className="theme-btn theme-btn-primary !h-8 !px-4 !py-0 text-[11px]">
                Cart
              </span>
            </nav>
          </div>
        </header>

        {/* ---- Hero (typography) ---- */}
        <section className="theme-container theme-page-pad py-10">
          <span className="theme-badge theme-badge-pill mb-4 w-24 justify-center bg-accent/15 text-accent">
            New Season
          </span>
          <h2 className="theme-heading max-w-sm text-4xl text-foreground">
            Where Magic Meets Style
          </h2>
          <p className="theme-body mt-3 max-w-sm text-sm text-muted-foreground">
            Premium kids fashion, crafted for little explorers.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button type="button" className="theme-btn theme-btn-primary" data-hover={design.buttons.hoverStyle}>
              Shop Now
            </button>
            <button type="button" className="theme-btn theme-btn-secondary" data-hover={design.buttons.hoverStyle}>
              Explore
            </button>
          </div>
        </section>

        {/* ---- Category chips ---- */}
        <section className="theme-container theme-page-pad flex flex-wrap gap-2">
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
        <section className="theme-container theme-page-pad py-8">
          <div className="theme-product-grid">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`theme-card theme-card-shadow-md ${
                  design.cards.border === "hairline"
                    ? "theme-card-hairline"
                    : design.cards.border === "strong"
                      ? "theme-card-strong"
                      : ""
                }`}
              >
                <div
                  className="mb-3 h-24 w-full rounded-lg"
                  style={{
                    background:
                      i === 0
                        ? "var(--primary)"
                        : i === 1
                          ? "var(--accent)"
                          : "var(--secondary)",
                    opacity: 0.85,
                    borderRadius:
                      design.cards.imageStyle === "rounded"
                        ? "var(--radius-card)"
                        : design.cards.imageStyle === "cover"
                          ? "0"
                          : "0.25rem",
                  }}
                />
                <span className="theme-card-title block text-foreground">
                  Product {i + 1}
                </span>
                <span className="theme-body mt-1 block text-[11px] text-muted-foreground">
                  Adorable &amp; soft
                </span>
                <div className="mt-3 flex items-center justify-between">
                  <span className="theme-card-price text-primary">$24</span>
                  <span className="theme-btn theme-btn-primary !h-8 !px-3 !py-0 text-[11px]" data-hover={design.buttons.hoverStyle}>
                    Add
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Footer ---- */}
        <footer
          className={`theme-footer ${
            design.footer.border === "hairline"
              ? "theme-footer-hairline"
              : design.footer.border === "strong"
                ? "theme-footer-border"
                : ""
          }`}
        >
          <div className="theme-container theme-page-pad">
            <div className="flex items-center justify-between">
              <span className="theme-heading font-semibold text-foreground">
                MUKRA
              </span>
              <span className="theme-body text-[11px]">
                Premium kids fashion · Bangladesh
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
