/**
 * Theme settings data layer — the only place that reads/writes the
 * `ThemeSettings` singleton row.
 *
 * Follows the existing `SiteSettings` pattern (singleton row, `getPrisma()`,
 * `upsert`). The storefront read is wrapped in `unstable_cache` so layouts
 * don't hit the database on every render, and `revalidateTag` on save keeps
 * the live theme fresh without a redeploy.
 *
 * The raw DB read/write are exported separately (`readThemeSettings`,
 * `writeThemeSettings`) so they can be unit-tested without the Next cache
 * machinery; the cached/public wrappers sit on top.
 */

import { unstable_cache, revalidateTag } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import {
  DEFAULT_THEME_SETTINGS,
  normalizeThemeSettings,
  activeThemeToCssVars,
  type ThemeSettings,
} from "@/lib/theme-settings";

const SETTINGS_ID = "global";
export const THEME_CACHE_TAG = "theme-settings";

/**
 * Raw read of the persisted theme settings, falling back to the defaults when
 * the database is unavailable or the row is missing/invalid. Never throws on
 * the read path — a broken theme never breaks the storefront.
 */
export async function readThemeSettings(): Promise<ThemeSettings> {
  const db = await getPrisma();
  if (!db) return DEFAULT_THEME_SETTINGS;

  try {
    const row = await db.themeSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!row || typeof row !== "object") return DEFAULT_THEME_SETTINGS;
    return normalizeThemeSettings({
      activeTheme: (row as Record<string, unknown>).activeTheme,
      presets: (row as Record<string, unknown>).presets,
    });
  } catch (error) {
    console.error("[theme-settings] Failed to load theme settings", error);
    return DEFAULT_THEME_SETTINGS;
  }
}

/**
 * Raw write of the full theme state. The input is normalized first, so invalid
 * colors are dropped back to defaults rather than corrupting the palette.
 */
export async function writeThemeSettings(input: unknown): Promise<ThemeSettings> {
  const db = await getPrisma();
  if (!db) throw new Error("Theme settings require a configured database");

  const settings = normalizeThemeSettings(input);
  await db.themeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      activeTheme: settings.activeTheme,
      presets: settings.presets as object,
    },
    update: {
      activeTheme: settings.activeTheme,
      presets: settings.presets as object,
    },
  });
  return settings;
}

/** Cached read for storefront layouts (avoids a DB query on every render). */
export const getThemeSettings = unstable_cache(
  readThemeSettings,
  ["theme-settings"],
  { tags: [THEME_CACHE_TAG], revalidate: 300 },
);

/**
 * Persists the full theme state (active theme + all three presets) and
 * invalidates the storefront cache. Returns the normalized result.
 */
export async function saveThemeSettings(input: unknown): Promise<ThemeSettings> {
  const settings = await writeThemeSettings(input);
  try {
    revalidateTag(THEME_CACHE_TAG);
  } catch {
    // Outside a Next request context (e.g. unit tests) cache invalidation is
    // a no-op; the write above already succeeded.
  }
  return settings;
}

/**
 * The CSS custom properties for the currently-active preset, ready to spread
 * onto a storefront wrapper. Falls back to the default light theme.
 */
export const getActiveThemeCssVars = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const settings = await readThemeSettings();
    return activeThemeToCssVars(settings);
  },
  ["theme-css-vars"],
  { tags: [THEME_CACHE_TAG], revalidate: 300 },
);
