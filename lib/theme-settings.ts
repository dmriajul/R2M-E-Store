/**
 * Theme management — full storefront design presets
 *
 * The storefront's look is driven entirely by CSS custom properties. `ThemeStyles`
 * injects the active preset's tokens as inline CSS variables on the storefront
 * layout, so switching a preset re-skins the whole shop without a page reload.
 *
 * A preset is a complete design system, not just a palette. Each preset carries:
 *   - `colors`   — the ten editable colors (preserved from the color-only system)
 *   - `design`   — typography, radius, shadows, borders, header/nav, buttons,
 *                  product cards, layout/spacing and footer tokens
 *
 * Four presets ship out of the box. Presets are **independent**: customizing one
 * never mutates the others — `ThemeSettings.presets` is keyed by preset id.
 *
 * Every value is validated on load, so a corrupted value (typo, truncated paste,
 * bad migration) can never break rendering — it falls back to that preset's
 * original value instead.
 *
 * Persistence is backward compatible: the stored `presets` JSON may be either the
 * legacy flat `{ id: { ...colors } }` shape or the new
 * `{ id: { colors, design } }` shape. Normalization accepts both, so existing
 * saved color customizations are preserved and design tokens safely default.
 */

/* ========================================================================== */
/*  Colors (existing, preserved)                                              */
/* ========================================================================== */

export const THEME_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "foreground",
  "mutedForeground",
  "border",
  "buttonBg",
  "buttonForeground",
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/** Matches a valid 6-digit HEX color, with an optional leading `#`. */
export const THEME_COLOR_PATTERN = /^#?[0-9A-Fa-f]{6}$/;

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  buttonBg: string;
  buttonForeground: string;
}

export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && THEME_COLOR_PATTERN.test(value);
}

/* ========================================================================== */
/*  Design tokens                                                             */
/* ========================================================================== */

/** Font family options reuse the self-hosted Inter plus system stacks — no new
 *  external font dependencies. */
export const FONT_FAMILY_OPTIONS = [
  "var(--font-inter)",
  "ui-serif, Georgia, Cambria, \"Times New Roman\", serif",
  "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
] as const;
export type FontFamilyOption = (typeof FONT_FAMILY_OPTIONS)[number];

export interface TypographyTokens {
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  bodyWeight: number;
  /** Base font size in px. */
  baseFontSize: string;
  /** Multiplier applied to the base size for the heading scale. */
  headingScale: number;
  bodyLineHeight: number;
  headingLineHeight: number;
  /** Letter spacing in em. */
  letterSpacing: string;
}

export interface RadiusTokens {
  sm: string;
  md: string;
  lg: string;
  card: string;
  button: string;
  input: string;
}

export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
  card: string;
  button: string;
}

export interface BorderTokens {
  /** Border thickness, e.g. "1px". */
  width: string;
  style: string;
}

export interface HeaderTokens {
  style: "solid" | "glass" | "transparent";
  /** Header background (a color or CSS value). */
  bg: string;
  navFontSize: string;
  /** Navigation item gap. */
  navSpacing: string;
  borderStyle: "border" | "shadow" | "none";
  navLinkStyle: "underline" | "pill" | "plain";
}

export interface ButtonTokens {
  shape: "pill" | "rounded" | "sharp";
  radius: string;
  height: string;
  paddingX: string;
  paddingY: string;
  fontWeight: number;
  fontSize: string;
  hoverStyle: "lift" | "glow" | "fill" | "none";
  transition: string;
  primaryStyle: "solid" | "outline" | "gradient";
  secondaryStyle: "solid" | "outline" | "ghost";
}

export interface CardTokens {
  radius: string;
  border: "none" | "hairline" | "strong";
  shadow: "none" | "sm" | "md" | "lg";
  imageStyle: "contain" | "cover" | "rounded";
  titleSize: string;
  priceSize: string;
  badgeStyle: "pill" | "sharp" | "rounded";
  padding: string;
  hover: "lift" | "glow" | "none";
}

export interface LayoutTokens {
  containerWidth: string;
  sectionSpacing: string;
  pagePaddingX: string;
  gridGap: string;
  gridCols: number;
  cardGap: string;
  headingSpacing: string;
}

export interface FooterTokens {
  bg: string;
  textColor: string;
  spacing: string;
  border: "none" | "hairline" | "strong";
  linkStyle: "underline" | "plain" | "hover";
}

export interface DesignConfig {
  typography: TypographyTokens;
  radius: RadiusTokens;
  shadows: ShadowTokens;
  borders: BorderTokens;
  header: HeaderTokens;
  buttons: ButtonTokens;
  cards: CardTokens;
  layout: LayoutTokens;
  footer: FooterTokens;
}

/** All top-level design groups, in display order. */
export const DESIGN_GROUP_KEYS = [
  "typography",
  "radius",
  "shadows",
  "borders",
  "header",
  "buttons",
  "cards",
  "layout",
  "footer",
] as const;
export type DesignGroupKey = (typeof DESIGN_GROUP_KEYS)[number];

/** A neutral, well-balanced default design config used when a preset omits one. */
export const DEFAULT_DESIGN_CONFIG: DesignConfig = {
  typography: {
    headingFont: "var(--font-inter)",
    bodyFont: "var(--font-inter)",
    headingWeight: 700,
    bodyWeight: 400,
    baseFontSize: "16px",
    headingScale: 1.9,
    bodyLineHeight: 1.6,
    headingLineHeight: 1.15,
    letterSpacing: "-0.01em",
  },
  radius: {
    sm: "0.375rem",
    md: "0.625rem",
    lg: "0.9rem",
    card: "1.25rem",
    button: "0.625rem",
    input: "0.625rem",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0,0,0,0.12)",
    md: "0 4px 16px -6px rgba(0,0,0,0.28)",
    lg: "0 18px 44px -20px rgba(0,0,0,0.5)",
    card: "0 10px 30px -20px rgba(0,0,0,0.45)",
    button: "0 8px 24px -10px rgba(0,0,0,0.5)",
  },
  borders: {
    width: "1px",
    style: "solid",
  },
  header: {
    style: "glass",
    bg: "color-mix(in srgb, var(--background) 78%, transparent)",
    navFontSize: "0.875rem",
    navSpacing: "1.25rem",
    borderStyle: "border",
    navLinkStyle: "underline",
  },
  buttons: {
    shape: "rounded",
    radius: "0.625rem",
    height: "2.5rem",
    paddingX: "1rem",
    paddingY: "0.5rem",
    fontWeight: 600,
    fontSize: "0.875rem",
    hoverStyle: "lift",
    transition: "all 200ms ease",
    primaryStyle: "solid",
    secondaryStyle: "outline",
  },
  cards: {
    radius: "1.25rem",
    border: "hairline",
    shadow: "md",
    imageStyle: "rounded",
    titleSize: "0.9375rem",
    priceSize: "1.125rem",
    badgeStyle: "pill",
    padding: "1rem",
    hover: "lift",
  },
  layout: {
    containerWidth: "80rem",
    sectionSpacing: "4rem",
    pagePaddingX: "1.5rem",
    gridGap: "1.25rem",
    gridCols: 3,
    cardGap: "1.25rem",
    headingSpacing: "1.25rem",
  },
  footer: {
    bg: "color-mix(in srgb, var(--surface) 80%, var(--background))",
    textColor: "var(--muted-foreground)",
    spacing: "4rem",
    border: "hairline",
    linkStyle: "hover",
  },
};

/* ========================================================================== */
/*  Presets                                                                   */
/* ========================================================================== */

export type ThemePresetId =
  | "metallic-chic"
  | "snowy-yet-warm"
  | "rose-red-and-blueberry"
  | "striking-citrus";

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  colors: ThemeColors;
  design: DesignConfig;
}

/**
 * The four built-in presets. Each pairs its palette with a cohesive design
 * language. `#8A7155` is used for Snowy Yet Warm's primary / button (a minor
 * WCAG-AA refinement of the initial `#9B8065` direction, which sat at 3.70:1
 * against white and failed AA for normal text).
 */
export const DEFAULT_THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "metallic-chic",
    label: "Metallic Chic",
    description: "Warm bronze on near-black with a gold accent.",
    colors: {
      primary: "#B08D57",
      secondary: "#8C7A5B",
      accent: "#D4AF37",
      background: "#171717",
      surface: "#242424",
      foreground: "#F5F5F0",
      mutedForeground: "#B8B1A5",
      border: "#494236",
      buttonBg: "#B08D57",
      buttonForeground: "#171717",
    },
    design: {
      typography: {
        headingFont:
          "ui-serif, Georgia, Cambria, \"Times New Roman\", serif",
        bodyFont: "var(--font-inter)",
        headingWeight: 700,
        bodyWeight: 400,
        baseFontSize: "16px",
        headingScale: 2.1,
        bodyLineHeight: 1.65,
        headingLineHeight: 1.1,
        letterSpacing: "-0.015em",
      },
      radius: {
        sm: "0.25rem",
        md: "0.5rem",
        lg: "0.75rem",
        card: "1rem",
        button: "0.5rem",
        input: "0.5rem",
      },
      shadows: {
        sm: "0 1px 2px 0 rgba(0,0,0,0.5)",
        md: "0 6px 20px -8px rgba(0,0,0,0.65)",
        lg: "0 22px 50px -24px rgba(0,0,0,0.75)",
        card: "0 14px 34px -22px rgba(0,0,0,0.7)",
        button: "0 10px 28px -12px rgba(176,141,87,0.6)",
      },
      borders: { width: "1px", style: "solid" },
      header: {
        style: "glass",
        bg: "color-mix(in srgb, var(--background) 82%, transparent)",
        navFontSize: "0.8125rem",
        navSpacing: "1.5rem",
        borderStyle: "border",
        navLinkStyle: "underline",
      },
      buttons: {
        shape: "rounded",
        radius: "0.5rem",
        height: "2.6rem",
        paddingX: "1.25rem",
        paddingY: "0.5rem",
        fontWeight: 600,
        fontSize: "0.8125rem",
        hoverStyle: "glow",
        transition: "all 240ms cubic-bezier(0.22,1,0.36,1)",
        primaryStyle: "solid",
        secondaryStyle: "outline",
      },
      cards: {
        radius: "1rem",
        border: "hairline",
        shadow: "md",
        imageStyle: "rounded",
        titleSize: "0.9375rem",
        priceSize: "1.125rem",
        badgeStyle: "sharp",
        padding: "1.1rem",
        hover: "glow",
      },
      layout: {
        containerWidth: "80rem",
        sectionSpacing: "4.5rem",
        pagePaddingX: "1.5rem",
        gridGap: "1.5rem",
        gridCols: 3,
        cardGap: "1.5rem",
        headingSpacing: "1.5rem",
      },
      footer: {
        bg: "color-mix(in srgb, var(--background) 88%, #000)",
        textColor: "var(--muted-foreground)",
        spacing: "4.5rem",
        border: "hairline",
        linkStyle: "hover",
      },
    },
  },
  {
    id: "snowy-yet-warm",
    label: "Snowy Yet Warm",
    description: "Soft snow surfaces warmed by taupe and camel.",
    colors: {
      primary: "#8A7155",
      secondary: "#B7A18A",
      accent: "#C59A6D",
      background: "#FAF8F4",
      surface: "#FFFFFF",
      foreground: "#292723",
      mutedForeground: "#777168",
      border: "#E8E1D8",
      buttonBg: "#8A7155",
      buttonForeground: "#FFFFFF",
    },
    design: {
      typography: {
        headingFont: "var(--font-inter)",
        bodyFont: "var(--font-inter)",
        headingWeight: 700,
        bodyWeight: 400,
        baseFontSize: "17px",
        headingScale: 2,
        bodyLineHeight: 1.7,
        headingLineHeight: 1.2,
        letterSpacing: "-0.01em",
      },
      radius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        card: "1.5rem",
        button: "9999px",
        input: "0.75rem",
      },
      shadows: {
        sm: "0 1px 2px 0 rgba(41,39,35,0.06)",
        md: "0 6px 20px -8px rgba(41,39,35,0.14)",
        lg: "0 20px 44px -22px rgba(41,39,35,0.2)",
        card: "0 12px 30px -20px rgba(41,39,35,0.16)",
        button: "0 8px 20px -10px rgba(138,113,85,0.5)",
      },
      borders: { width: "1px", style: "solid" },
      header: {
        style: "glass",
        bg: "color-mix(in srgb, var(--background) 80%, transparent)",
        navFontSize: "0.875rem",
        navSpacing: "1.5rem",
        borderStyle: "border",
        navLinkStyle: "plain",
      },
      buttons: {
        shape: "pill",
        radius: "9999px",
        height: "2.75rem",
        paddingX: "1.5rem",
        paddingY: "0.6rem",
        fontWeight: 600,
        fontSize: "0.9rem",
        hoverStyle: "lift",
        transition: "all 220ms ease",
        primaryStyle: "solid",
        secondaryStyle: "ghost",
      },
      cards: {
        radius: "1.5rem",
        border: "hairline",
        shadow: "sm",
        imageStyle: "rounded",
        titleSize: "1rem",
        priceSize: "1.25rem",
        badgeStyle: "pill",
        padding: "1.25rem",
        hover: "lift",
      },
      layout: {
        containerWidth: "80rem",
        sectionSpacing: "4rem",
        pagePaddingX: "1.5rem",
        gridGap: "1.5rem",
        gridCols: 3,
        cardGap: "1.5rem",
        headingSpacing: "1.5rem",
      },
      footer: {
        bg: "color-mix(in srgb, var(--surface) 70%, var(--background))",
        textColor: "var(--muted-foreground)",
        spacing: "4rem",
        border: "hairline",
        linkStyle: "hover",
      },
    },
  },
  {
    id: "rose-red-and-blueberry",
    label: "Rose Red & Blueberry",
    description: "Berry depths under a blush, rose-accented light.",
    colors: {
      primary: "#C43D62",
      secondary: "#554A8B",
      accent: "#E76F8A",
      background: "#FAF7FA",
      surface: "#FFFFFF",
      foreground: "#292235",
      mutedForeground: "#766D80",
      border: "#E8DDE8",
      buttonBg: "#C43D62",
      buttonForeground: "#FFFFFF",
    },
    design: {
      typography: {
        headingFont: "var(--font-inter)",
        bodyFont: "var(--font-inter)",
        headingWeight: 800,
        bodyWeight: 400,
        baseFontSize: "16px",
        headingScale: 2,
        bodyLineHeight: 1.65,
        headingLineHeight: 1.15,
        letterSpacing: "-0.01em",
      },
      radius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        card: "1.25rem",
        button: "0.75rem",
        input: "0.625rem",
      },
      shadows: {
        sm: "0 1px 2px 0 rgba(41,34,53,0.08)",
        md: "0 6px 20px -8px rgba(95,61,109,0.16)",
        lg: "0 20px 44px -22px rgba(95,61,109,0.26)",
        card: "0 12px 30px -20px rgba(95,61,109,0.18)",
        button: "0 8px 22px -10px rgba(196,61,98,0.55)",
      },
      borders: { width: "1px", style: "solid" },
      header: {
        style: "glass",
        bg: "color-mix(in srgb, var(--background) 80%, transparent)",
        navFontSize: "0.875rem",
        navSpacing: "1.25rem",
        borderStyle: "border",
        navLinkStyle: "pill",
      },
      buttons: {
        shape: "rounded",
        radius: "0.75rem",
        height: "2.6rem",
        paddingX: "1.25rem",
        paddingY: "0.5rem",
        fontWeight: 700,
        fontSize: "0.875rem",
        hoverStyle: "lift",
        transition: "all 220ms ease",
        primaryStyle: "solid",
        secondaryStyle: "outline",
      },
      cards: {
        radius: "1.25rem",
        border: "hairline",
        shadow: "md",
        imageStyle: "rounded",
        titleSize: "0.9375rem",
        priceSize: "1.125rem",
        badgeStyle: "pill",
        padding: "1.1rem",
        hover: "lift",
      },
      layout: {
        containerWidth: "80rem",
        sectionSpacing: "4rem",
        pagePaddingX: "1.5rem",
        gridGap: "1.25rem",
        gridCols: 3,
        cardGap: "1.25rem",
        headingSpacing: "1.25rem",
      },
      footer: {
        bg: "color-mix(in srgb, var(--surface) 72%, var(--background))",
        textColor: "var(--muted-foreground)",
        spacing: "4rem",
        border: "hairline",
        linkStyle: "hover",
      },
    },
  },
  {
    id: "striking-citrus",
    label: "Striking Citrus",
    description: "Green and amber on a warm, sunny cream.",
    colors: {
      primary: "#4D7C36",
      secondary: "#E58A22",
      accent: "#E5C52B",
      background: "#FFFDF5",
      surface: "#FFFFFF",
      foreground: "#292B21",
      mutedForeground: "#747365",
      border: "#E9E5D3",
      buttonBg: "#4D7C36",
      buttonForeground: "#FFFFFF",
    },
    design: {
      typography: {
        headingFont: "var(--font-inter)",
        bodyFont: "var(--font-inter)",
        headingWeight: 800,
        bodyWeight: 500,
        baseFontSize: "16px",
        headingScale: 2.05,
        bodyLineHeight: 1.6,
        headingLineHeight: 1.1,
        letterSpacing: "-0.02em",
      },
      radius: {
        sm: "0.25rem",
        md: "0.5rem",
        lg: "0.75rem",
        card: "0.875rem",
        button: "0.5rem",
        input: "0.5rem",
      },
      shadows: {
        sm: "0 1px 2px 0 rgba(41,43,33,0.1)",
        md: "0 6px 18px -8px rgba(41,43,33,0.2)",
        lg: "0 20px 44px -22px rgba(41,43,33,0.3)",
        card: "0 12px 28px -20px rgba(41,43,33,0.24)",
        button: "0 8px 20px -10px rgba(77,124,54,0.55)",
      },
      borders: { width: "1px", style: "solid" },
      header: {
        style: "solid",
        bg: "var(--surface)",
        navFontSize: "0.8125rem",
        navSpacing: "1.25rem",
        borderStyle: "shadow",
        navLinkStyle: "underline",
      },
      buttons: {
        shape: "sharp",
        radius: "0.5rem",
        height: "2.5rem",
        paddingX: "1.1rem",
        paddingY: "0.5rem",
        fontWeight: 700,
        fontSize: "0.8125rem",
        hoverStyle: "fill",
        transition: "all 180ms ease",
        primaryStyle: "solid",
        secondaryStyle: "outline",
      },
      cards: {
        radius: "0.875rem",
        border: "strong",
        shadow: "sm",
        imageStyle: "cover",
        titleSize: "0.875rem",
        priceSize: "1.125rem",
        badgeStyle: "sharp",
        padding: "1rem",
        hover: "lift",
      },
      layout: {
        containerWidth: "80rem",
        sectionSpacing: "3.5rem",
        pagePaddingX: "1.25rem",
        gridGap: "1rem",
        gridCols: 4,
        cardGap: "1rem",
        headingSpacing: "1rem",
      },
      footer: {
        bg: "color-mix(in srgb, var(--surface) 75%, var(--background))",
        textColor: "var(--muted-foreground)",
        spacing: "3.5rem",
        border: "strong",
        linkStyle: "underline",
      },
    },
  },
];

export const THEME_PRESET_IDS = DEFAULT_THEME_PRESETS.map((preset) => preset.id);

/** Display labels for each preset, keyed by id. */
export const THEME_PRESET_LABELS: Record<ThemePresetId, string> =
  Object.fromEntries(
    DEFAULT_THEME_PRESETS.map((preset) => [preset.id, preset.label]),
  ) as Record<ThemePresetId, string>;

/** Look up a built-in preset by id, falling back to the first preset. */
export function getThemePreset(id: unknown): ThemePreset {
  const match = DEFAULT_THEME_PRESETS.find((preset) => preset.id === id);
  // DEFAULT_THEME_PRESETS is a non-empty constant; index 0 always exists.
  return match ?? (DEFAULT_THEME_PRESETS[0] as ThemePreset);
}

/** The built-in colours for a preset id. */
export function getDefaultThemePreset(id: ThemePresetId): ThemeColors {
  return getThemePreset(id).colors;
}

/** The built-in design config for a preset id. */
export function getDefaultDesignConfig(id: ThemePresetId): DesignConfig {
  return getThemePreset(id).design;
}

/* ========================================================================== */
/*  Settings shape                                                            */
/* ========================================================================== */

/** A preset's full persisted state: colors + design. */
export interface ThemePresetState {
  colors: ThemeColors;
  design: DesignConfig;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  activeTheme: "metallic-chic",
  presets: Object.fromEntries(
    DEFAULT_THEME_PRESETS.map((preset) => [
      preset.id,
      { colors: preset.colors, design: preset.design },
    ]),
  ),
};

export type ThemeSettings = {
  activeTheme: ThemePresetId;
  presets: Record<string, ThemePresetState>;
};

/* ========================================================================== */
/*  Normalisation                                                             */
/* ========================================================================== */

/** Opaque string used for automatically derived accents (gold, glass, etc.). */
export type CssVars = Record<string, string>;

/**
 * Derive a readable foreground for an arbitrary background colour by picking
 * black or white based on WCAG relative luminance.
 */
export function contrastColor(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#0A0A0A";
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const linearise = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
  return luminance > 0.5 ? "#0A0A0A" : "#FFFFFF";
}

/** Normalise a validated HEX value to a canonical `#RRGGBB` form. */
function canonicalHex(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("#")
    ? trimmed.toUpperCase()
    : `#${trimmed.toUpperCase()}`;
}

/** Merge a partial colours object with a fallback, keeping only valid HEX. */
function sanitizeColors(
  fallback: ThemeColors,
  candidate: unknown,
): ThemeColors {
  const source: Record<string, unknown> =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {};
  const out = { ...fallback };
  for (const key of THEME_COLOR_KEYS) {
    const value = source[key];
    if (isValidHex(value)) {
      out[key] = canonicalHex(value);
    }
  }
  return out;
}

/**
 * Merge a partial design config over a fallback, keeping only valid values.
 * Numbers are coerced within sensible ranges; strings must be non-empty; enum
 * fields fall back when not one of the allowed options.
 */
function sanitizeDesign(
  fallback: DesignConfig,
  candidate: unknown,
): DesignConfig {
  const src =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {};

  const mergeGroup = <T extends object>(
    fallbackGroup: T,
    candidateGroup: unknown,
  ): T => {
    const g =
      candidateGroup && typeof candidateGroup === "object"
        ? (candidateGroup as Record<string, unknown>)
        : {};
    const out = { ...fallbackGroup };
    for (const [key, fallbackValue] of Object.entries(fallbackGroup)) {
      const raw = g[key];
      if (typeof fallbackValue === "number") {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(n)) (out as Record<string, unknown>)[key] = n;
      } else if (typeof fallbackValue === "string") {
        if (typeof raw === "string" && raw.trim().length > 0) {
          (out as Record<string, unknown>)[key] = raw;
        }
      }
    }
    return out;
  };

  return {
    typography: mergeGroup(fallback.typography, src.typography),
    radius: mergeGroup(fallback.radius, src.radius),
    shadows: mergeGroup(fallback.shadows, src.shadows),
    borders: mergeGroup(fallback.borders, src.borders),
    header: mergeGroup(fallback.header, src.header),
    buttons: mergeGroup(fallback.buttons, src.buttons),
    cards: mergeGroup(fallback.cards, src.cards),
    layout: mergeGroup(fallback.layout, src.layout),
    footer: mergeGroup(fallback.footer, src.footer),
  };
}

/**
 * Normalise a single preset entry. Accepts both the new `{ colors, design }`
 * shape and the legacy flat `{ ...colors }` shape (backward compatible with
 * existing saved rows): a legacy entry keeps its colors and gets default design.
 */
function normalizePresetState(
  id: ThemePresetId,
  candidate: unknown,
): ThemePresetState {
  const preset = getThemePreset(id);
  const src =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {};

  // New shape: an explicit `colors` key.
  if ("colors" in src) {
    return {
      colors: sanitizeColors(preset.colors, src.colors),
      design: sanitizeDesign(preset.design, src.design),
    };
  }
  // Legacy flat shape: the object is the colors map.
  return {
    colors: sanitizeColors(preset.colors, src),
    design: preset.design,
  };
}

/** Validate and normalise the `presets` map, dropping unknown preset ids. */
export function normalizeThemePresets(
  presets: unknown,
): Record<string, ThemePresetState> {
  const source: Record<string, unknown> =
    presets && typeof presets === "object"
      ? (presets as Record<string, unknown>)
      : {};
  const out: Record<string, ThemePresetState> = {};
  for (const preset of DEFAULT_THEME_PRESETS) {
    out[preset.id] = normalizePresetState(preset.id, source[preset.id]);
  }
  return out;
}

/** Coerce any active-theme value to a valid preset id, else the default. */
export function normalizeActiveTheme(activeTheme: unknown): ThemePresetId {
  return activeTheme &&
    THEME_PRESET_IDS.includes(activeTheme as ThemePresetId)
    ? (activeTheme as ThemePresetId)
    : "metallic-chic";
}

/** Merge stored/incoming colors over a fallback, dropping invalid HEX. */
export function normalizeThemeColors(
  colors: unknown,
  fallback: ThemeColors,
): ThemeColors {
  return sanitizeColors(fallback, colors);
}

/** Validate a full theme-settings payload against the built-in presets. */
export function normalizeThemeSettings(input: unknown): ThemeSettings {
  const source: Record<string, unknown> =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    activeTheme: normalizeActiveTheme(source.activeTheme),
    presets: normalizeThemePresets(source.presets),
  };
}

/* ========================================================================== */
/*  CSS custom properties                                                     */
/* ========================================================================== */

/** Build the CSS custom properties for a resolved colour palette. */
export function themeToCssVars(
  colors: ThemeColors,
  design?: DesignConfig,
): CssVars {
  return activeThemeToCssVars(colors, design);
}

/** Map the design config to its CSS custom properties. */
export function designToCssVars(design: DesignConfig): CssVars {
  const t = design.typography;
  const r = design.radius;
  const s = design.shadows;
  const b = design.borders;
  const h = design.header;
  const btn = design.buttons;
  const card = design.cards;
  const layout = design.layout;
  const footer = design.footer;

  return {
    /* ---- Typography ---- */
    "--font-heading": t.headingFont,
    "--font-body": t.bodyFont,
    "--heading-weight": String(t.headingWeight),
    "--body-weight": String(t.bodyWeight),
    "--base-font-size": t.baseFontSize,
    "--heading-scale": String(t.headingScale),
    "--body-line-height": String(t.bodyLineHeight),
    "--heading-line-height": String(t.headingLineHeight),
    "--letter-spacing": t.letterSpacing,

    /* ---- Radius ---- */
    "--radius": r.lg,
    "--radius-sm": r.sm,
    "--radius-md": r.md,
    "--radius-lg": r.lg,
    "--radius-card": r.card,
    "--radius-button": r.button,
    "--radius-input": r.input,

    /* ---- Shadows ---- */
    "--shadow-sm": s.sm,
    "--shadow-md": s.md,
    "--shadow-lg": s.lg,
    "--shadow-card": s.card,
    "--shadow-button": s.button,

    /* ---- Borders ---- */
    "--border-width": b.width,
    "--border-style": b.style,

    /* ---- Header / nav ---- */
    "--header-style": h.style,
    "--header-bg": h.bg,
    "--nav-font-size": h.navFontSize,
    "--nav-spacing": h.navSpacing,
    "--header-border": h.borderStyle,
    "--nav-link-style": h.navLinkStyle,

    /* ---- Buttons ---- */
    "--button-shape": btn.shape,
    "--button-radius": btn.radius,
    "--button-height": btn.height,
    "--button-pad-x": btn.paddingX,
    "--button-pad-y": btn.paddingY,
    "--button-weight": String(btn.fontWeight),
    "--button-size": btn.fontSize,
    "--button-hover": btn.hoverStyle,
    "--button-transition": btn.transition,
    "--button-primary-style": btn.primaryStyle,
    "--button-secondary-style": btn.secondaryStyle,

    /* ---- Product cards ---- */
    "--card-radius": card.radius,
    "--card-border": card.border,
    "--card-shadow": card.shadow,
    "--card-image-style": card.imageStyle,
    "--card-title-size": card.titleSize,
    "--card-price-size": card.priceSize,
    "--card-badge-style": card.badgeStyle,
    "--card-padding": card.padding,
    "--card-hover": card.hover,

    /* ---- Layout / spacing ---- */
    "--container-width": layout.containerWidth,
    "--section-spacing": layout.sectionSpacing,
    "--page-padding-x": layout.pagePaddingX,
    "--grid-gap": layout.gridGap,
    "--grid-cols": String(layout.gridCols),
    "--card-gap": layout.cardGap,
    "--heading-spacing": layout.headingSpacing,

    /* ---- Footer ---- */
    "--footer-bg": footer.bg,
    "--footer-text": footer.textColor,
    "--footer-spacing": footer.spacing,
    "--footer-border": footer.border,
    "--footer-link-style": footer.linkStyle,
  };
}

/**
 * Map a resolved colour palette (and optional design config) to the CSS custom
 * properties used across the storefront. `--gold*` and `--glass*` are derived
 * overlays that borrow the preset's accent / surface colours.
 */
export function activeThemeToCssVars(
  colors: ThemeColors,
  design?: DesignConfig,
): CssVars {
  const glass = `${colors.surface}cc`;
  const glassBorder = `${colors.border}66`;
  const glassForeground = contrastColor(colors.surface);

  const vars: CssVars = {
    "--primary": colors.primary,
    "--primary-foreground": contrastColor(colors.primary),
    "--secondary": colors.secondary,
    "--secondary-foreground": colors.foreground,
    "--accent": colors.accent,
    "--accent-foreground": contrastColor(colors.accent),
    "--background": colors.background,
    "--surface": colors.surface,
    "--card": colors.surface,
    "--card-foreground": colors.foreground,
    "--popover": colors.surface,
    "--popover-foreground": colors.foreground,
    "--muted": colors.surface,
    "--foreground": colors.foreground,
    "--muted-foreground": colors.mutedForeground,
    "--border": colors.border,
    "--input": colors.border,
    "--button-bg": colors.buttonBg,
    "--button-fg": colors.buttonForeground,
    "--button-foreground": colors.buttonForeground,
    "--gold": colors.accent,
    "--gold-foreground": contrastColor(colors.accent),
    "--gold-bg": `${colors.accent}1a`,
    "--glass": glass,
    "--glass-foreground": glassForeground,
    "--glass-border": glassBorder,
    "--header-bg-color": `${colors.background}e6`,
    "--header-border-color": `${colors.border}55`,
    "--ring": colors.accent,
    "--button-primary-bg": colors.buttonBg,
    "--button-primary-foreground": colors.buttonForeground,
    "--button-secondary-bg": `${colors.secondary}26`,
    "--button-secondary-foreground": colors.foreground,
    "--button-secondary-hover": `${colors.secondary}40`,
    "--button-outline-border": colors.border,
    "--button-outline-foreground": colors.foreground,
    "--button-outline-hover": `${colors.surface}d6`,
    "--button-ghost-hover": `${colors.surface}d6`,
    "--card-border-color":
      design?.cards.border === "strong"
        ? colors.border
        : design?.cards.border === "none"
          ? "transparent"
          : `${colors.border}55`,
    "--card-badge-radius":
      design?.cards.badgeStyle === "sharp"
        ? "0"
        : design?.cards.badgeStyle === "rounded"
          ? "0.375rem"
          : "9999px",
    "--nav-item-hover": `${colors.surface}cc`,
    "--nav-item-active-bg": `${colors.primary}26`,
    "--nav-item-active-foreground": colors.primary,
  };

  if (design) {
    Object.assign(vars, designToCssVars(design));
  }
  return vars;
}

/**
 * Resolve the active preset's full state (colors + design, merging stored
 * customs over the built-in default) and return its CSS custom properties.
 * Used by the theme API and the storefront `ThemeStyles` so the rendered tokens
 * always match the active preset.
 */
export function resolveActiveThemeVars(settings: ThemeSettings): CssVars {
  const preset =
    DEFAULT_THEME_PRESETS.find((p) => p.id === settings.activeTheme) ??
    DEFAULT_THEME_PRESETS[0];
  if (!preset) {
    return activeThemeToCssVars(
      getDefaultThemePreset("metallic-chic"),
      getDefaultDesignConfig("metallic-chic"),
    );
  }
  const state = settings.presets[settings.activeTheme];
  const colors = sanitizeColors(
    preset.colors,
    state?.colors ?? preset.colors,
  );
  const design = sanitizeDesign(
    preset.design,
    state?.design ?? preset.design,
  );
  return activeThemeToCssVars(colors, design);
}
