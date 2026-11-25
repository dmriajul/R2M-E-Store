/**
 * MUKRA — 3-Preset Theme Management System
 *
 * Three administrator-editable color presets (Light Minimal, Dark Modern,
 * Premium Elegant) plus the mapping from a preset's ten colors onto the
 * storefront's CSS custom properties.
 *
 * The storefront consumes these through `ThemeStyles` (see
 * `components/theme/ThemeStyles.tsx`), which injects the active preset's
 * variables into the DOM on the server so there is no flash of the wrong
 * theme. The Admin Console is intentionally NOT wrapped — it keeps its own
 * consistent dark chrome (the `:root` defaults in `globals.css`).
 *
 * Nothing here touches the database directly; `lib/data/theme-settings.ts` is
 * the only layer that reads/writes the `ThemeSettings` row.
 */

export const THEME_PRESET_IDS = ["light", "dark", "premium"] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

export const THEME_PRESET_LABELS: Readonly<Record<ThemePresetId, string>> = {
  light: "Light Minimal",
  dark: "Dark Modern",
  premium: "Premium Elegant",
};

/**
 * The ten editable colors for a preset. Each maps onto one or more CSS
 * custom properties (see `themeToCssVars`).
 */
export interface ThemeColors {
  /** Brand / primary accent — links, focus rings, brand surfaces. */
  primary: string;
  /** Secondary / muted surfaces. */
  secondary: string;
  /** Accent — hover states, secondary emphasis. */
  accent: string;
  /** Page background. */
  background: string;
  /** Card / surface background. */
  surface: string;
  /** Primary text. */
  foreground: string;
  /** Secondary / muted text. */
  mutedForeground: string;
  /** Borders and inputs. */
  border: string;
  /** Primary button background. */
  buttonBg: string;
  /** Text on a primary button. */
  buttonFg: string;
}

export type ThemePresets = Record<ThemePresetId, ThemeColors>;

export interface ThemeSettings {
  /** Which preset is currently live on the storefront. */
  activeTheme: ThemePresetId;
  /** The three presets, each independently customizable. */
  presets: ThemePresets;
}

/* -------------------------------------------------------------------------- */
/*  Default presets                                                           */
/* -------------------------------------------------------------------------- */

export const DEFAULT_THEME_PRESETS: ThemePresets = {
  light: {
    primary: "#111827",
    secondary: "#F3F4F6",
    accent: "#4F46E5",
    background: "#FAFAF9",
    surface: "#FFFFFF",
    foreground: "#111827",
    mutedForeground: "#6B7280",
    border: "#E5E7EB",
    buttonBg: "#111827",
    buttonFg: "#FFFFFF",
  },
  dark: {
    primary: "#3B82F6",
    secondary: "#1E293B",
    accent: "#22D3EE",
    background: "#0B0F17",
    surface: "#131A26",
    foreground: "#F1F5F9",
    mutedForeground: "#94A3B8",
    border: "#1E293B",
    buttonBg: "#3B82F6",
    buttonFg: "#FFFFFF",
  },
  premium: {
    primary: "#1C1917",
    secondary: "#EDE6DA",
    accent: "#A16207",
    background: "#F5F1EA",
    surface: "#FBF8F3",
    foreground: "#1C1917",
    mutedForeground: "#78716C",
    border: "#E7E0D6",
    buttonBg: "#1C1917",
    buttonFg: "#FBF8F3",
  },
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  activeTheme: "light",
  presets: DEFAULT_THEME_PRESETS,
};

/* -------------------------------------------------------------------------- */
/*  Color helpers                                                             */
/* -------------------------------------------------------------------------- */

const HEX_6 = /^#?([0-9a-fA-F]{6})$/;

/** Parses a `#RRGGBB` (or `RRGGBB`) string into [r, g, b]. */
export function parseHex(value: string): [number, number, number] | null {
  const match = HEX_6.exec(value.trim());
  if (!match || match[1] === undefined) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** True when the value is a valid 6-digit HEX color (with optional `#`). */
export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && HEX_6.test(value.trim());
}

/** Relative luminance (0–1) per WCAG, or null for invalid input. */
function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const channels = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const r = channels[0] ?? 0;
  const g = channels[1] ?? 0;
  const b = channels[2] ?? 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A readable foreground (near-black or white) for a given background HEX,
 * derived from its luminance. Used for the *derived* foreground tokens so the
 * admin only has to pick the ten base colors.
 */
export function contrastColor(hex: string): string {
  const l = luminance(hex);
  return l === null || l > 0.45 ? "#0B0B0F" : "#FFFFFF";
}

/** `#RRGGBB` + alpha → `rgba(...)`. Falls back to opaque for invalid input. */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/* -------------------------------------------------------------------------- */
/*  Preset normalization (safe fallbacks)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Merges a stored/incoming preset over the defaults, dropping any invalid
 * HEX value back to the default. This is what makes missing/invalid/partial
 * theme data safe: the storefront always renders a valid palette.
 */
export function normalizeThemeColors(
  partial: unknown,
  fallback: ThemeColors,
): ThemeColors {
  const source = (typeof partial === "object" && partial !== null ? partial : {}) as Record<string, unknown>;
  const result = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof ThemeColors)[]) {
    const value = source[key];
    if (isValidHex(value)) result[key] = value.trim();
  }
  return result;
}

/**
 * Builds a full `ThemePresets` from an arbitrary stored value, falling back to
 * the defaults for any missing or malformed preset.
 */
export function normalizeThemePresets(value: unknown): ThemePresets {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const result = { ...DEFAULT_THEME_PRESETS };
  for (const id of THEME_PRESET_IDS) {
    result[id] = normalizeThemeColors(source[id], DEFAULT_THEME_PRESETS[id]);
  }
  return result;
}

/** Normalizes the active theme id, falling back to `"light"`. */
export function normalizeActiveTheme(value: unknown): ThemePresetId {
  return THEME_PRESET_IDS.includes(value as ThemePresetId)
    ? (value as ThemePresetId)
    : "light";
}

/** Normalizes a full settings payload into a safe `ThemeSettings`. */
export function normalizeThemeSettings(value: unknown): ThemeSettings {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    activeTheme: normalizeActiveTheme(source.activeTheme),
    presets: normalizeThemePresets(source.presets),
  };
}

/* -------------------------------------------------------------------------- */
/*  Preset → CSS custom properties                                           */
/* -------------------------------------------------------------------------- */

/**
 * Maps a preset's ten colors onto the storefront's CSS custom properties,
 * including the derived tokens (foregrounds, ring, input, glass, brand
 * helpers). The result is a plain `style` object ready to spread onto an
 * element — the active preset is what `ThemeStyles` injects.
 */
export function themeToCssVars(colors: ThemeColors): Record<string, string> {
  const isLight = (luminance(colors.background) ?? 0.5) > 0.5;
  // Brand "gold" helpers are tied to the theme's primary so gold-branded
  // storefront surfaces follow the active palette instead of a fixed gold.
  const goldSoft = hexToRgba(colors.primary, 0.15);
  const goldGlow = hexToRgba(colors.primary, 0.25);

  return {
    "--background": colors.background,
    "--foreground": colors.foreground,

    "--card": colors.surface,
    "--card-foreground": colors.foreground,

    "--popover": colors.surface,
    "--popover-foreground": colors.foreground,

    "--primary": colors.primary,
    "--primary-foreground": contrastColor(colors.primary),

    "--secondary": colors.secondary,
    "--secondary-foreground": contrastColor(colors.secondary),

    "--muted": colors.surface,
    "--muted-foreground": colors.mutedForeground,

    "--accent": colors.accent,
    "--accent-foreground": contrastColor(colors.accent),

    "--destructive": "#EF4444",
    "--destructive-foreground": "#FFFFFF",

    "--success": "#22C55E",
    "--warning": "#F59E0B",

    "--border": colors.border,
    "--input": colors.border,
    "--ring": colors.primary,

    // Glassmorphism follows the theme's light/dark direction.
    "--glass": isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255, 255, 255, 0.05)",
    "--glass-border": hexToRgba(colors.border, 0.5),
    "--glass-strong": isLight ? "rgba(255, 255, 255, 0.85)" : "rgba(11, 15, 23, 0.85)",

    // Buttons use dedicated tokens so "Button Background/Text" are independent
    // of the brand "Primary Color".
    "--button-bg": colors.buttonBg,
    "--button-fg": colors.buttonFg,

    // Brand helpers follow the primary palette.
    "--gold": colors.primary,
    "--gold-soft": goldSoft,
    "--gold-strong": contrastColor(colors.primary) === "#0B0B0F" ? colors.primary : "#F1D97A",
    "--gold-glow": goldGlow,
  };
}

/** The CSS variables for the active preset of a settings payload. */
export function activeThemeToCssVars(settings: ThemeSettings): Record<string, string> {
  return themeToCssVars(settings.presets[settings.activeTheme]);
}
