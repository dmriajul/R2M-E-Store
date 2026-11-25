/** Theme management contract: presets, normalization, validation, persistence, storefront rendering, auth. */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { installTestDatabase } from "./support/test-database";
import {
  DEFAULT_THEME_PRESETS,
  DEFAULT_THEME_SETTINGS,
  THEME_PRESET_IDS,
  activeThemeToCssVars,
  contrastColor,
  isValidHex,
  normalizeActiveTheme,
  normalizeThemeColors,
  normalizeThemePresets,
  normalizeThemeSettings,
  themeToCssVars,
  type ThemeColors,
  type ThemeSettings,
} from "../lib/theme-settings";
import { readThemeSettings, writeThemeSettings } from "../lib/data/theme-settings";
import { themeSettingsSchema } from "../lib/validations";
import type { PrismaLikeClient } from "../lib/prisma";

const env = { ...process.env };
const scope = globalThis as typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};
afterEach(() => {
  delete scope.prisma;
  delete scope.prismaUnavailable;
  process.env = { ...env };
});

/* -------------------------------------------------------------------------- */
/*  HEX validation                                                           */
/* -------------------------------------------------------------------------- */

test("HEX validation accepts valid colors and rejects invalid ones", () => {
  assert.equal(isValidHex("#1A2B3C"), true);
  assert.equal(isValidHex("1a2b3c"), true);
  assert.equal(isValidHex("#FFF"), false);
  assert.equal(isValidHex("#GGGGGG"), false);
  assert.equal(isValidHex("red"), false);
  assert.equal(isValidHex(""), false);
  assert.equal(isValidHex("#12345"), false);
  assert.equal(isValidHex(null), false);
});

/* -------------------------------------------------------------------------- */
/*  Default theme loading / safe fallbacks                                    */
/* -------------------------------------------------------------------------- */

test("normalizeThemeSettings falls back to defaults for missing/invalid input", () => {
  assert.deepEqual(normalizeThemeSettings(undefined), DEFAULT_THEME_SETTINGS);
  assert.deepEqual(normalizeThemeSettings(null), DEFAULT_THEME_SETTINGS);
  assert.deepEqual(normalizeThemeSettings("nope"), DEFAULT_THEME_SETTINGS);

  // Partial presets keep defaults for missing colors and drop invalid HEX.
  const partial = normalizeThemeSettings({
    activeTheme: "dark",
    presets: {
      dark: { primary: "not-a-color", background: "#123456" },
    },
  });
  assert.equal(partial.activeTheme, "dark");
  assert.equal(partial.presets.dark.background, "#123456");
  // Invalid HEX reverted to the default primary.
  assert.equal(partial.presets.dark.primary, DEFAULT_THEME_PRESETS.dark.primary);
  // Untouched presets keep their defaults.
  assert.deepEqual(partial.presets.light, DEFAULT_THEME_PRESETS.light);
});

test("normalizeActiveTheme falls back to light for unknown ids", () => {
  assert.equal(normalizeActiveTheme("dark"), "dark");
  assert.equal(normalizeActiveTheme("premium"), "premium");
  assert.equal(normalizeActiveTheme("nope"), "light");
  assert.equal(normalizeActiveTheme(undefined), "light");
});

test("normalizeThemeColors merges over a fallback and drops invalid HEX", () => {
  const result = normalizeThemeColors({ primary: "#AABBCC", accent: "bad" }, DEFAULT_THEME_PRESETS.light);
  assert.equal(result.primary, "#AABBCC");
  assert.equal(result.accent, DEFAULT_THEME_PRESETS.light.accent);
});

test("normalizeThemePresets preserves all three preset ids", () => {
  const result = normalizeThemePresets({});
  assert.deepEqual(Object.keys(result).sort(), [...THEME_PRESET_IDS].sort());
});

test("readThemeSettings returns defaults when no database is configured", async () => {
  delete scope.prisma;
  const settings = await readThemeSettings();
  assert.deepEqual(settings, DEFAULT_THEME_SETTINGS);
});

/* -------------------------------------------------------------------------- */
/*  Switching between all three presets                                       */
/* -------------------------------------------------------------------------- */

test("each preset maps to distinct, valid CSS variables", () => {
  for (const id of THEME_PRESET_IDS) {
    const vars = themeToCssVars(DEFAULT_THEME_PRESETS[id]);
    // The ten editable colors all surface as variables.
    for (const key of [
      "--primary",
      "--secondary",
      "--accent",
      "--background",
      "--card",
      "--foreground",
      "--muted-foreground",
      "--border",
      "--button-bg",
      "--button-fg",
    ] as const) {
      assert.ok(vars[key], `${id} should define ${key}`);
      assert.match(vars[key], /^#|^rgba/, `${id} ${key} should be a color`);
    }
    // Derived tokens exist too.
    assert.ok(vars["--ring"]);
    assert.ok(vars["--primary-foreground"]);
    assert.ok(vars["--glass"]);
  }

  // The three presets are visually distinct on the key surfaces.
  const lightBg = themeToCssVars(DEFAULT_THEME_PRESETS.light)["--background"];
  const darkBg = themeToCssVars(DEFAULT_THEME_PRESETS.dark)["--background"];
  const premiumBg = themeToCssVars(DEFAULT_THEME_PRESETS.premium)["--background"];
  assert.notEqual(lightBg, darkBg);
  assert.notEqual(lightBg, premiumBg);
  assert.notEqual(darkBg, premiumBg);
});

test("activeThemeToCssVars uses the active preset", () => {
  const light = activeThemeToCssVars({ activeTheme: "light", presets: DEFAULT_THEME_PRESETS });
  const dark = activeThemeToCssVars({ activeTheme: "dark", presets: DEFAULT_THEME_PRESETS });
  assert.equal(light["--background"], DEFAULT_THEME_PRESETS.light.background);
  assert.equal(dark["--background"], DEFAULT_THEME_PRESETS.dark.background);
});

test("contrastColor picks a readable foreground for a background", () => {
  assert.equal(contrastColor("#FFFFFF"), "#0B0B0F"); // light bg -> dark text
  assert.equal(contrastColor("#000000"), "#FFFFFF"); // dark bg -> light text
  assert.equal(contrastColor("bad"), "#0B0B0F"); // invalid -> safe default
});

/* -------------------------------------------------------------------------- */
/*  Validation schema (invalid HEX rejection)                                 */
/* -------------------------------------------------------------------------- */

test("themeSettingsSchema accepts a valid payload", () => {
  const result = themeSettingsSchema.safeParse({
    activeTheme: "premium",
    presets: DEFAULT_THEME_PRESETS,
  });
  assert.equal(result.success, true);
});

test("themeSettingsSchema rejects invalid HEX colors", () => {
  const bad = structuredClone(DEFAULT_THEME_PRESETS) as unknown as ThemeColors & Record<string, unknown>;
  bad.light = { ...DEFAULT_THEME_PRESETS.light, primary: "not-a-color" };
  const result = themeSettingsSchema.safeParse({ activeTheme: "light", presets: bad });
  assert.equal(result.success, false);
});

test("themeSettingsSchema rejects an unknown activeTheme", () => {
  const result = themeSettingsSchema.safeParse({
    activeTheme: "neon",
    presets: DEFAULT_THEME_PRESETS,
  });
  assert.equal(result.success, false);
});

/* -------------------------------------------------------------------------- */
/*  Persistence: save customized colors, reset a preset                       */
/* -------------------------------------------------------------------------- */

test("writeThemeSettings persists customized colors and reloads them", async () => {
  const fixture = installTestDatabase();
  const customized: ThemeColors = { ...DEFAULT_THEME_PRESETS.light, primary: "#123456", accent: "#654321" };
  const payload = {
    activeTheme: "light",
    presets: { ...DEFAULT_THEME_PRESETS, light: customized },
  };

  const saved = await writeThemeSettings(payload);
  assert.equal(saved.presets.light.primary, "#123456");
  assert.equal(saved.presets.light.accent, "#654321");

  const reloaded = await readThemeSettings();
  assert.equal(reloaded.presets.light.primary, "#123456");
  assert.equal(reloaded.presets.light.accent, "#654321");
  // The other presets are untouched.
  assert.deepEqual(reloaded.presets.dark, DEFAULT_THEME_PRESETS.dark);
  assert.equal(fixture.rows("themeSettings").length, 1);
});

test("writeThemeSettings resets a preset to its defaults", async () => {
  installTestDatabase();
  // First customize, then reset to defaults.
  const customized = { ...DEFAULT_THEME_PRESETS.dark, primary: "#ABCDEF" };
  await writeThemeSettings({
    activeTheme: "dark",
    presets: { ...DEFAULT_THEME_PRESETS, dark: customized },
  });

  const reset = await writeThemeSettings({
    activeTheme: "dark",
    presets: { ...DEFAULT_THEME_PRESETS, dark: DEFAULT_THEME_PRESETS.dark },
  });
  assert.deepEqual(reset.presets.dark, DEFAULT_THEME_PRESETS.dark);

  const reloaded = await readThemeSettings();
  assert.deepEqual(reloaded.presets.dark, DEFAULT_THEME_PRESETS.dark);
});

test("writeThemeSettings drops invalid colors rather than storing them", async () => {
  installTestDatabase();
  const saved = await writeThemeSettings({
    activeTheme: "light",
    presets: {
      ...DEFAULT_THEME_PRESETS,
      light: { ...DEFAULT_THEME_PRESETS.light, primary: "bad-hex" },
    },
  });
  assert.equal(saved.presets.light.primary, DEFAULT_THEME_PRESETS.light.primary);
});

test("writeThemeSettings throws when no database is configured", async () => {
  delete scope.prisma;
  await assert.rejects(
    () => writeThemeSettings({ activeTheme: "light", presets: DEFAULT_THEME_PRESETS }),
    /configured database/,
  );
});

/* -------------------------------------------------------------------------- */
/*  Storefront theme rendering                                               */
/* -------------------------------------------------------------------------- */

test("themeToCssVars renders the ten colors onto the storefront variables", () => {
  const colors: ThemeColors = {
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    background: "#444444",
    surface: "#555555",
    foreground: "#666666",
    mutedForeground: "#777777",
    border: "#888888",
    buttonBg: "#999999",
    buttonFg: "#AAAAAA",
  };
  const vars = themeToCssVars(colors);
  assert.equal(vars["--primary"], "#111111");
  assert.equal(vars["--secondary"], "#222222");
  assert.equal(vars["--accent"], "#333333");
  assert.equal(vars["--background"], "#444444");
  assert.equal(vars["--card"], "#555555");
  assert.equal(vars["--foreground"], "#666666");
  assert.equal(vars["--muted-foreground"], "#777777");
  assert.equal(vars["--border"], "#888888");
  assert.equal(vars["--button-bg"], "#999999");
  assert.equal(vars["--button-fg"], "#AAAAAA");
});

/* -------------------------------------------------------------------------- */
/*  API route authorization                                                  */
/* -------------------------------------------------------------------------- */
// The admin theme API gates on `requireActionRole` from `@/lib/auth`, which
// reads the NextAuth session (a Next request scope). We stub that module via
// Node's module mocking so the route's authorization + validation contract can
// be exercised without a live session. The route module is re-imported per
// test with a cache-busting query so each stub is applied freshly.

let routeLoad = 0;
function loadThemeRoute() {
  routeLoad += 1;
  return import("../app/api/admin/settings/theme/route?bust=" + routeLoad);
}

const ANON_GATE = {
  requireActionRole: async () => ({
    ok: false,
    reason: "unauthenticated",
    message: "Administrator access required",
  }),
};
const ADMIN_GATE = {
  requireActionRole: async () => ({
    ok: true,
    user: { id: "admin-1", name: "Admin", email: "admin@example.test", role: "SUPER_ADMIN" },
  }),
};

test("theme API: unauthenticated GET is rejected with 403", async (context) => {
  context.mock.module("../lib/auth", { namedExports: ANON_GATE });
  const { GET } = await loadThemeRoute();
  const response = await GET();
  assert.equal(response.status, 403);
  const body = (await response.json()) as { success: boolean };
  assert.equal(body.success, false);
});

test("theme API: unauthenticated PUT is rejected with 403", async (context) => {
  context.mock.module("../lib/auth", { namedExports: ANON_GATE });
  const { PUT } = await loadThemeRoute();
  const response = await PUT(new NextRequest("http://localhost:3000/api/admin/settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeTheme: "light", presets: DEFAULT_THEME_PRESETS }),
  }));
  assert.equal(response.status, 403);
});

test("theme API: authorized GET returns the persisted theme", async (context) => {
  installTestDatabase();
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { GET } = await loadThemeRoute();
  const response = await GET();
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: ThemeSettings; success: boolean };
  assert.equal(body.success, true);
  assert.equal(body.data.activeTheme, "light");
  assert.deepEqual(Object.keys(body.data.presets).sort(), [...THEME_PRESET_IDS].sort());
});

test("theme API: authorized PUT saves the active theme and presets", async (context) => {
  installTestDatabase();
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { PUT } = await loadThemeRoute();
  const response = await PUT(new NextRequest("http://localhost:3000/api/admin/settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeTheme: "premium", presets: DEFAULT_THEME_PRESETS }),
  }));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: ThemeSettings; success: boolean; source?: string };
  assert.equal(body.success, true);
  assert.equal(body.data.activeTheme, "premium");
  assert.equal(body.source, "database");

  // Persisted and retrievable on a fresh read.
  const reloaded = await readThemeSettings();
  assert.equal(reloaded.activeTheme, "premium");
});

test("theme API: authorized PUT rejects an invalid HEX payload with 400", async (context) => {
  installTestDatabase();
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { PUT } = await loadThemeRoute();
  const badPresets = structuredClone(DEFAULT_THEME_PRESETS) as unknown as ThemeColors & Record<string, unknown>;
  badPresets.light = { ...DEFAULT_THEME_PRESETS.light, primary: "not-a-color" };
  const response = await PUT(new NextRequest("http://localhost:3000/api/admin/settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeTheme: "light", presets: badPresets }),
  }));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { success: boolean; error: string };
  assert.equal(body.success, false);
  assert.ok(body.error.length > 0);
});
