/** ThemePreview layout & design contract: full-width responsive container, scrollable nav, wrapping footer, and faithful token rendering. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { ThemePreview } from "../components/theme/ThemePreview";
import {
  DEFAULT_THEME_PRESETS,
  getDefaultDesignConfig,
  getDefaultThemePreset,
  themeToCssVars,
  type DesignConfig,
  type ThemeColors,
} from "../lib/theme-settings";

function renderPreview(colors: ThemeColors, design: DesignConfig) {
  const html = renderToStaticMarkup(
    createElement(ThemePreview, { colors, design }),
  );
  const { document } = new JSDOM(html).window;
  const root = document.body.firstElementChild as HTMLElement | null;
  assert.ok(root, "ThemePreview renders a root wrapper element");
  const surface = root.firstElementChild as HTMLElement | null;
  assert.ok(surface, "ThemePreview renders an inner themed surface element");
  return { html, document, root, surface };
}

function classTokens(element: Element): Set<string> {
  return new Set(
    (element.getAttribute("class") ?? "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

test("ThemePreview uses full available width and spans multi-column form sections", () => {
  const colors = getDefaultThemePreset("metallic-chic");
  const design = getDefaultDesignConfig("metallic-chic");
  const { root, surface } = renderPreview(colors, design);

  const rootClasses = classTokens(root);
  assert.ok(rootClasses.has("w-full"), "outer wrapper fills full available width");
  assert.ok(
    rootClasses.has("col-span-full") || rootClasses.has("sm:col-span-2"),
    "outer wrapper spans all columns inside FormSection grids",
  );
  assert.ok(rootClasses.has("min-w-0"), "outer wrapper allows flex/grid shrinking without overflow");

  const surfaceClasses = classTokens(surface);
  assert.ok(surfaceClasses.has("w-full"), "inner theme surface fills full wrapper width");
  assert.ok(surfaceClasses.has("min-w-0"), "inner theme surface sets min-w-0");
});

test("ThemePreview removes the restrictive fixed minimum width that caused clipping", () => {
  for (const preset of DEFAULT_THEME_PRESETS) {
    const { html, surface } = renderPreview(preset.colors, preset.design);
    const surfaceClass = surface.getAttribute("class") ?? "";

    assert.ok(
      !surfaceClass.includes("min-w-[680px]"),
      `${preset.id}: inner surface must not force min-w-[680px]`,
    );
    assert.doesNotMatch(
      html,
      /\bmin-w-\[\d+(?:px|rem)\]/,
      `${preset.id}: preview must not contain a rigid fixed pixel/rem min-width`,
    );
  }
});

test("ThemePreview navigation can scroll horizontally when needed without compressing items", () => {
  const colors = getDefaultThemePreset("snowy-yet-warm");
  const design: DesignConfig = {
    ...getDefaultDesignConfig("snowy-yet-warm"),
    header: {
      ...getDefaultDesignConfig("snowy-yet-warm").header,
      navSpacing: "2.75rem",
    },
  };
  const { document } = renderPreview(colors, design);

  const nav = document.querySelector("header nav");
  assert.ok(nav, "header contains a <nav> element");

  const navClasses = classTokens(nav);
  assert.ok(navClasses.has("overflow-x-auto"), "navigation enables horizontal scrolling");
  assert.ok(navClasses.has("min-w-0"), "navigation can shrink inside the flex header row");
  assert.ok(navClasses.has("whitespace-nowrap"), "navigation items stay on a single scrollable row");
  assert.equal((nav as HTMLElement).style.gap, "2.75rem", "navigation preserves custom navSpacing");

  const labels = Array.from<Element>(nav.children).map((el) =>
    el.textContent?.trim(),
  );
  assert.deepEqual(labels, ["Shop", "Collections", "New", "Cart"]);
});

test("ThemePreview footer allows content to wrap cleanly", () => {
  const colors = getDefaultThemePreset("rose-red-and-blueberry");
  const design = getDefaultDesignConfig("rose-red-and-blueberry");
  const { document } = renderPreview(colors, design);

  const footer = document.querySelector("footer.theme-footer");
  assert.ok(footer, "renders themed footer");

  const footerRow = footer.querySelector(".theme-container > div");
  assert.ok(footerRow, "footer contains inner layout row");

  const rowClasses = classTokens(footerRow);
  assert.ok(rowClasses.has("flex"), "footer row is a flex container");
  assert.ok(rowClasses.has("flex-wrap"), "footer row allows content to wrap");
  assert.match(footer.textContent ?? "", /MUKRA/);
  assert.match(footer.textContent ?? "", /Premium kids fashion/);
});

test("ThemePreview preserves theme tokens, sections, and variant classes across all presets", () => {
  for (const preset of DEFAULT_THEME_PRESETS) {
    const { document, surface } = renderPreview(preset.colors, preset.design);
    const expectedVars = themeToCssVars(preset.colors, preset.design);

    // Key CSS custom properties are scoped directly onto the preview surface.
    for (const token of [
      "--primary",
      "--secondary",
      "--accent",
      "--background",
      "--card",
      "--foreground",
      "--button-bg",
      "--button-fg",
    ] as const) {
      assert.equal(
        surface.style.getPropertyValue(token),
        expectedVars[token],
        `${preset.id} applies ${token} onto the preview surface`,
      );
    }

    // Core storefront sections remain intact.
    assert.match(document.querySelector("h2")?.textContent ?? "", /Where Magic Meets Style/);
    assert.equal(document.querySelectorAll(".theme-product-grid .theme-card").length, 3);
    const buttons = Array.from<Element>(
      document.querySelectorAll("button.theme-btn"),
    );
    assert.equal(buttons.length, 2);
    for (const button of buttons) {
      assert.equal(button.getAttribute("data-hover"), preset.design.buttons.hoverStyle);
    }
  }

  // Verify header, card, and footer border/image style branches.
  const baseColors = getDefaultThemePreset("striking-citrus");
  const baseDesign = getDefaultDesignConfig("striking-citrus");
  const customDesign: DesignConfig = {
    ...baseDesign,
    header: { ...baseDesign.header, borderStyle: "shadow" },
    buttons: { ...baseDesign.buttons, hoverStyle: "glow" },
    cards: { ...baseDesign.cards, border: "strong", imageStyle: "cover" },
    footer: { ...baseDesign.footer, border: "strong" },
  };
  const { document } = renderPreview(baseColors, customDesign);

  assert.ok(classTokens(document.querySelector("header")!).has("theme-header-shadow"));
  const cards = Array.from<Element>(
    document.querySelectorAll(".theme-product-grid .theme-card"),
  );
  assert.ok(cards.every((card) => classTokens(card).has("theme-card-strong")));
  const firstImage = cards[0]?.querySelector("div") as HTMLElement | null;
  assert.equal(firstImage?.style.borderRadius, "0");
  assert.ok(classTokens(document.querySelector("footer")!).has("theme-footer-border"));
});
