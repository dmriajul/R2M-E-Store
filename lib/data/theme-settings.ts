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
import {
  DatabaseUnavailableError,
  databaseFailureReason,
  getPrisma,
  getPrismaErrorCode,
  requireDatabase,
} from "@/lib/prisma";
import {
  DEFAULT_THEME_SETTINGS,
  normalizeThemeSettings,
  resolveActiveThemeVars,
  type ThemeSettings,
} from "@/lib/theme-settings";

const SETTINGS_ID = "global";
export const THEME_CACHE_TAG = "theme-settings";

function safeThemeErrorSummary(error: unknown): string {
  return (
    databaseFailureReason(error) ??
    getPrismaErrorCode(error) ??
    (error instanceof Error && error.name ? error.name : "unknown error")
  );
}

/**
 * Raw read of the persisted theme settings, falling back to the defaults when
 * the database is unavailable or the row is missing/invalid. Never throws on
 * the read path — a broken theme never breaks the storefront.
 */
export async function readThemeSettings(): Promise<ThemeSettings> {
  const result = await readThemeSettingsWithSource();
  return result.settings;
}

export type ThemeSettingsSource = "database" | "defaults";

/**
 * Read with an explicit `source` so callers (the Admin Theme API) can tell the
 * UI whether the values came from the database or from the fail-safe defaults.
 * The Admin console must never present defaults as if they were saved values.
 */
export async function readThemeSettingsWithSource(): Promise<{
  settings: ThemeSettings;
  source: ThemeSettingsSource;
}> {
  try {
    const db = await getPrisma();
    if (!db || !db.themeSettings) {
      return { settings: DEFAULT_THEME_SETTINGS, source: "defaults" };
    }

    const row = await db.themeSettings.findUnique({ where: { id: SETTINGS_ID } });
    // The database was reachable and the query succeeded — `source` is
    // "database" whether or not a row exists yet (a missing row simply means
    // "no saved settings yet", which the defaults correctly represent).
    if (!row || typeof row !== "object") {
      return { settings: DEFAULT_THEME_SETTINGS, source: "database" };
    }
    return {
      settings: normalizeThemeSettings({
        activeTheme: (row as Record<string, unknown>).activeTheme,
        presets: (row as Record<string, unknown>).presets,
      }),
      source: "database",
    };
  } catch (error) {
    console.error(
      `[theme-settings] Failed to load theme settings (${safeThemeErrorSummary(error)})`,
    );
    return { settings: DEFAULT_THEME_SETTINGS, source: "defaults" };
  }
}

/**
 * Raw write of the full theme state. The input is normalized first, so invalid
 * colors are dropped back to defaults rather than corrupting the palette.
 * Throws `DatabaseUnavailableError` when no database is configured or reachable.
 */
export async function writeThemeSettings(input: unknown): Promise<ThemeSettings> {
  const settings = normalizeThemeSettings(input);
  await requireDatabase(async (db) => {
    if (!db.themeSettings) {
      throw new DatabaseUnavailableError();
    }
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
    return resolveActiveThemeVars(settings);
  },
  ["theme-css-vars"],
  { tags: [THEME_CACHE_TAG], revalidate: 300 },
);
