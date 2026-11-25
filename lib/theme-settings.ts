/**
 * Theme management
 *
 * The storefront's look is driven entirely by CSS custom properties. `ThemeStyles`
 * injects the active preset's tokens as inline CSS variables on the storefront
 * layout, so switching a preset re-skins the whole shop without a page reload.
 *
 * Four presets ship out of the box. Each preset carries its own full set of
 * ten colors, and presets are **independent**: customizing one never mutates the
 * others — `ThemeSettings.presets` is keyed by preset id.
 *
 * Every color is validated with `isValidHex` on load, so a corrupted value
 * (typo, truncated paste, bad migration) can never break rendering — it falls
 * back to that preset's original color instead.
 */

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
}

/**
 * The four built-in presets. `#8A7155` is used for Snowy Yet Warm's primary /
 * button (a minor WCAG-AA refinement of the initial `#9B8065` direction, which
 * sat at 3.70:1 against white and failed AA for normal text). Every other value
 * is the requested direction and passes WCAG-AA.
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
  const match = DEFAULT_THEME_PRESETS.find(
    (preset) => preset.id === id,
  );
  // DEFAULT_THEME_PRESETS is a non-empty constant; index 0 always exists.
  return match ?? (DEFAULT_THEME_PRESETS[0] as ThemePreset);
}

/** The built-in colours for a preset id (used by Reset / fresh loads). */
export function getDefaultThemePreset(id: ThemePresetId): ThemeColors {
  return getThemePreset(id).colors;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  activeTheme: "metallic-chic",
  presets: Object.fromEntries(
    DEFAULT_THEME_PRESETS.map((preset) => [preset.id, preset.colors]),
  ),
};

export type ThemeSettings = {
  activeTheme: ThemePresetId;
  presets: Record<string, Partial<ThemeColors>>;
};

export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && THEME_COLOR_PATTERN.test(value);
}

/** Opaque string used for automatically derived accents (gold, glass, etc.). */
export type CssVars = Record<string, string>;

/**
 * Derive a readable foreground for an arbitrary background colour by picking
 * black or white based on WCAG relative luminance. Used for glass and gold
 * overlays that sit on top of the user's chosen surface colours.
 */
export function contrastColor(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return "#0A0A0A";
  }
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
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
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

/** Validate and normalise the `presets` map, dropping unknown preset ids. */
export function normalizeThemePresets(
  presets: unknown,
): Record<string, Partial<ThemeColors>> {
  const source: Record<string, unknown> =
    presets && typeof presets === "object"
      ? (presets as Record<string, unknown>)
      : {};
  const out: Record<string, Partial<ThemeColors>> = {};
  for (const preset of DEFAULT_THEME_PRESETS) {
    out[preset.id] = sanitizeColors(preset.colors, source[preset.id]);
  }
  return out;
}

/** Coerce any active-theme value to a valid preset id, else the default. */
export function normalizeActiveTheme(
  activeTheme: unknown,
): ThemePresetId {
  return (
    activeTheme &&
    THEME_PRESET_IDS.includes(activeTheme as ThemePresetId)
      ? (activeTheme as ThemePresetId)
      : "metallic-chic"
  );
}

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

/** Build the CSS custom properties for a resolved colour palette. */
export function themeToCssVars(colors: ThemeColors): CssVars {
  return activeThemeToCssVars(colors);
}

/**
 * Resolve the active preset's palette (merging stored customs over the built-in
 * default) and return its CSS custom properties. Used by the theme API and the
 * storefront `ThemeStyles` so the rendered tokens always match the active theme.
 */
export function resolveActiveThemeVars(settings: ThemeSettings): CssVars {
  const preset =
    DEFAULT_THEME_PRESETS.find((p) => p.id === settings.activeTheme) ??
    DEFAULT_THEME_PRESETS[0];
  if (!preset) return activeThemeToCssVars(getDefaultThemePreset("metallic-chic"));
  const colors = sanitizeColors(
    preset.colors,
    settings.presets[settings.activeTheme] ?? preset.colors,
  );
  return activeThemeToCssVars(colors);
}

/**
 * Map a resolved colour palette to CSS custom properties used across the
 * storefront and admin UI. `--gold*` and `--glass*` are derived overlays that
 * borrow the preset's accent / surface colours, so each theme looks cohesive.
 */
export function activeThemeToCssVars(colors: ThemeColors): CssVars {
  const glass = `${colors.surface}cc`;
  const glassBorder = `${colors.border}66`;
  const glassForeground = contrastColor(colors.surface);

  return {
    "--primary": colors.primary,
    "--primary-foreground": contrastColor(colors.primary),
    "--secondary": colors.secondary,
    "--secondary-foreground": colors.foreground,
    "--accent": colors.accent,
    "--accent-foreground": contrastColor(colors.accent),
    "--background": colors.background,
    "--surface": colors.surface,
    // `--card` / `--popover` / `--muted` feed the `@theme inline` Tailwind tokens
    // (`bg-card`, `bg-popover`, `bg-muted`). Derive them from the surface so
    // cards and popovers follow the selected preset rather than the static
    // `:root` defaults — otherwise the theme only partially applies.
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
    "--header-bg": `${colors.background}e6`,
    "--header-border": `${colors.border}55`,
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
    "--card-border": `${colors.border}55`,
    "--nav-item-hover": `${colors.surface}cc`,
    "--nav-item-active-bg": `${colors.primary}26`,
    "--nav-item-active-foreground": colors.primary,
  };
}
