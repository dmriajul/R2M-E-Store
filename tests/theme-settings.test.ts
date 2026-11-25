/** Theme management contract: presets, normalization, validation, persistence, storefront rendering, auth. */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { installTestDatabase } from "./support/test-database";
import {
  DEFAULT_THEME_PRESETS,
  DEFAULT_THEME_SETTINGS,
  THEME_COLOR_KEYS,
  THEME_PRESET_IDS,
  contrastColor,
  getDefaultDesignConfig,
  getDefaultThemePreset,
  getThemePreset,
  isValidHex,
  normalizeActiveTheme,
  normalizeThemeColors,
  normalizeThemePresets,
  normalizeThemeSettings,
  resolveActiveThemeVars,
  themeToCssVars,
  THEME_PRESET_LABELS,
  type ThemeColors,
  type ThemePresetId,
  type ThemePresetState,
  type ThemeSettings,
} from "../lib/theme-settings";
import {
  readThemeSettings,
  readThemeSettingsWithSource,
  writeThemeSettings,
} from "../lib/data/theme-settings";
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

/** Build a `presets` record from the built-in presets (all four, by id). */
function presetsRecord(
  overrides: Partial<Record<ThemePresetId, Partial<ThemeColors>>> = {},
): Record<string, ThemePresetState> {
  const record: Record<string, ThemePresetState> = {};
  for (const preset of DEFAULT_THEME_PRESETS) {
    record[preset.id] = { colors: { ...preset.colors }, design: preset.design };
  }
  for (const id of Object.keys(overrides) as ThemePresetId[]) {
    // Merge the override over a fresh copy of the default so every color key
    // remains present and typed as a complete ThemeColors.
    const base = getDefaultThemePreset(id);
    record[id] = {
      colors: { ...base, ...(overrides[id] ?? {}) },
      design: getDefaultDesignConfig(id),
    };
  }
  return record;
}

/** Convenience: the default preset state (colors + design) for an id. */
function defaultPresetState(id: ThemePresetId): ThemePresetState {
  return { colors: getDefaultThemePreset(id), design: getDefaultDesignConfig(id) };
}

/* -------------------------------------------------------------------------- */
/*  Four presets: definition + colour shape                                   */
/* -------------------------------------------------------------------------- */

test("exactly four presets are defined with distinct ids and labels", () => {
  assert.equal(DEFAULT_THEME_PRESETS.length, 4);
  assert.deepEqual(
    DEFAULT_THEME_PRESETS.map((p) => p.id).sort(),
    [...THEME_PRESET_IDS].sort(),
  );
  for (const preset of DEFAULT_THEME_PRESETS) {
    assert.ok(preset.label.length > 0, `${preset.id} has a label`);
    assert.ok(preset.description.length > 0, `${preset.id} has a description`);
  }
  // The three retired presets must be gone.
  for (const retired of ["light", "dark", "premium"]) {
    assert.ok(
      !(THEME_PRESET_IDS as readonly string[]).includes(retired),
      `retired preset ${retired} removed`,
    );
  }
});

test("each preset defines exactly the ten required colors as valid HEX", () => {
  const expected = [
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
  ];
  assert.deepEqual([...THEME_COLOR_KEYS], expected);

  for (const preset of DEFAULT_THEME_PRESETS) {
    assert.deepEqual(Object.keys(preset.colors).sort(), [...expected].sort());
    for (const [key, value] of Object.entries(preset.colors)) {
      assert.ok(isValidHex(value), `${preset.id} ${key} is valid HEX (${value})`);
    }
  }
});

test("the four requested palettes are present with their identity colors", () => {
  const byId = new Map(DEFAULT_THEME_PRESETS.map((p) => [p.id, p.colors]));
  assert.equal(byId.get("metallic-chic")?.primary, "#B08D57");
  assert.equal(byId.get("metallic-chic")?.background, "#171717");
  assert.equal(byId.get("snowy-yet-warm")?.background, "#FAF8F4");
  assert.equal(byId.get("snowy-yet-warm")?.surface, "#FFFFFF");
  assert.equal(byId.get("rose-red-and-blueberry")?.primary, "#C43D62");
  assert.equal(byId.get("rose-red-and-blueberry")?.secondary, "#554A8B");
  assert.equal(byId.get("striking-citrus")?.primary, "#4D7C36");
  assert.equal(byId.get("striking-citrus")?.accent, "#E5C52B");
});

test("THEME_PRESET_LABELS and getThemePreset/getDefaultThemePreset resolve by id", () => {
  for (const preset of DEFAULT_THEME_PRESETS) {
    assert.equal(THEME_PRESET_LABELS[preset.id], preset.label);
    assert.deepEqual(getThemePreset(preset.id).colors, preset.colors);
    assert.deepEqual(getDefaultThemePreset(preset.id), preset.colors);
  }
  // Unknown id falls back to the first preset safely.
  assert.equal(getThemePreset("nope").id, DEFAULT_THEME_PRESETS[0]!.id);
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
    activeTheme: "rose-red-and-blueberry",
    presets: {
      "rose-red-and-blueberry": { colors: { primary: "not-a-color", background: "#123456" } },
    },
  });
  assert.equal(partial.activeTheme, "rose-red-and-blueberry");
  assert.equal(
    partial.presets["rose-red-and-blueberry"]?.colors.background,
    "#123456",
  );
  // Invalid HEX reverted to the default primary.
  assert.equal(
    partial.presets["rose-red-and-blueberry"]?.colors.primary,
    getDefaultThemePreset("rose-red-and-blueberry").primary,
  );
  // Untouched presets keep their defaults.
  assert.deepEqual(
    partial.presets["metallic-chic"],
    defaultPresetState("metallic-chic"),
  );
});

test("normalizeActiveTheme falls back to metallic-chic for unknown ids", () => {
  assert.equal(normalizeActiveTheme("snowy-yet-warm"), "snowy-yet-warm");
  assert.equal(normalizeActiveTheme("nope"), "metallic-chic");
  assert.equal(normalizeActiveTheme(undefined), "metallic-chic");
  assert.equal(normalizeActiveTheme("light"), "metallic-chic");
});

test("normalizeThemeColors merges over a fallback and drops invalid HEX", () => {
  const fallback = getDefaultThemePreset("striking-citrus");
  const result = normalizeThemeColors({ primary: "#AABBCC", accent: "bad" }, fallback);
  assert.equal(result.primary, "#AABBCC");
  assert.equal(result.accent, fallback.accent);
});

test("normalizeThemePresets preserves all four preset ids", () => {
  const result = normalizeThemePresets({});
  assert.deepEqual(Object.keys(result).sort(), [...THEME_PRESET_IDS].sort());
});

test("readThemeSettings returns defaults when no database is configured", async () => {
  delete scope.prisma;
  const settings = await readThemeSettings();
  assert.deepEqual(settings, DEFAULT_THEME_SETTINGS);
});

/* -------------------------------------------------------------------------- */
/*  Independent customization                                                  */
/* -------------------------------------------------------------------------- */

test("customizing one preset never mutates another preset", () => {
  const customized: ThemePresetState = {
    colors: { ...getDefaultThemePreset("metallic-chic"), primary: "#112233" },
    design: getDefaultDesignConfig("metallic-chic"),
  };
  const settings = normalizeThemeSettings({
    activeTheme: "metallic-chic",
    presets: { "metallic-chic": customized },
  });
  assert.equal(settings.presets["metallic-chic"]?.colors.primary, "#112233");
  // All other presets are intact defaults, untouched by the customization.
  for (const id of THEME_PRESET_IDS.filter((id) => id !== "metallic-chic")) {
    assert.deepEqual(settings.presets[id], defaultPresetState(id));
  }
  // The built-in defaults were not mutated either.
  assert.equal(getDefaultThemePreset("metallic-chic").primary, "#B08D57");
});

/* -------------------------------------------------------------------------- */
/*  Switching between all four presets                                       */
/* -------------------------------------------------------------------------- */

test("each preset maps to distinct, valid CSS variables", () => {
  for (const id of THEME_PRESET_IDS) {
    const vars = themeToCssVars(getDefaultThemePreset(id));
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

  // The four presets are visually distinct on the key surfaces.
  const backgrounds = THEME_PRESET_IDS.map(
    (id) => themeToCssVars(getDefaultThemePreset(id))["--background"],
  );
  for (let i = 0; i < backgrounds.length; i += 1) {
    for (let j = i + 1; j < backgrounds.length; j += 1) {
      assert.notEqual(backgrounds[i], backgrounds[j]);
    }
  }
});

test("resolveActiveThemeVars uses the active preset and its customs", () => {
  const settings: ThemeSettings = {
    activeTheme: "snowy-yet-warm",
    presets: {
      "snowy-yet-warm": {
        colors: { ...getDefaultThemePreset("snowy-yet-warm"), background: "#012345" },
        design: getDefaultDesignConfig("snowy-yet-warm"),
      },
    },
  };
  const vars = resolveActiveThemeVars(settings);
  assert.equal(vars["--background"], "#012345");
  assert.equal(vars["--background"].toUpperCase(), "#012345");
  // Another preset's customization is ignored for the active theme.
  assert.equal(vars["--primary"], getDefaultThemePreset("snowy-yet-warm").primary);
});

test("contrastColor picks a readable foreground for a background", () => {
  assert.equal(contrastColor("#FFFFFF"), "#0A0A0A"); // light bg -> dark text
  assert.equal(contrastColor("#000000"), "#FFFFFF"); // dark bg -> light text
  assert.equal(contrastColor("bad"), "#0A0A0A"); // invalid -> safe default
});

/* -------------------------------------------------------------------------- */
/*  Validation schema (invalid HEX rejection)                                 */
/* -------------------------------------------------------------------------- */

test("themeSettingsSchema accepts a valid payload", () => {
  const result = themeSettingsSchema.safeParse({
    activeTheme: "striking-citrus",
    presets: presetsRecord(),
  });
  assert.equal(result.success, true);
});

test("themeSettingsSchema rejects invalid HEX colors", () => {
  const bad = presetsRecord({
    "rose-red-and-blueberry": { primary: "not-a-color" },
  });
  const result = themeSettingsSchema.safeParse({
    activeTheme: "rose-red-and-blueberry",
    presets: bad,
  });
  assert.equal(result.success, false);
});

test("themeSettingsSchema rejects an unknown activeTheme", () => {
  const result = themeSettingsSchema.safeParse({
    activeTheme: "neon",
    presets: presetsRecord(),
  });
  assert.equal(result.success, false);
});

/* -------------------------------------------------------------------------- */
/*  Persistence: save customized colors, reset a preset                       */
/* -------------------------------------------------------------------------- */

test("writeThemeSettings persists customized colors and reloads them", async () => {
  const fixture = installTestDatabase();
  const customized: Partial<ThemeColors> = { primary: "#123456", accent: "#654321" };
  const payload = {
    activeTheme: "metallic-chic",
    presets: presetsRecord({ "metallic-chic": customized }),
  };

  const saved = await writeThemeSettings(payload);
  assert.equal(saved.presets["metallic-chic"]?.colors.primary, "#123456");
  assert.equal(saved.presets["metallic-chic"]?.colors.accent, "#654321");

  const reloaded = await readThemeSettings();
  assert.equal(reloaded.presets["metallic-chic"]?.colors.primary, "#123456");
  assert.equal(reloaded.presets["metallic-chic"]?.colors.accent, "#654321");
  // The other presets are untouched.
  assert.deepEqual(reloaded.presets["snowy-yet-warm"], defaultPresetState("snowy-yet-warm"));
  assert.equal(fixture.rows("themeSettings").length, 1);
});

test("writeThemeSettings resets a preset to its defaults", async () => {
  installTestDatabase();
  // First customize, then reset to defaults.
  await writeThemeSettings({
    activeTheme: "striking-citrus",
    presets: presetsRecord({ "striking-citrus": { primary: "#ABCDEF" } }),
  });

  const reset = await writeThemeSettings({
    activeTheme: "striking-citrus",
    presets: presetsRecord(),
  });
  assert.deepEqual(reset.presets["striking-citrus"], defaultPresetState("striking-citrus"));

  const reloaded = await readThemeSettings();
  assert.deepEqual(reloaded.presets["striking-citrus"], defaultPresetState("striking-citrus"));
});

test("writeThemeSettings drops invalid colors rather than storing them", async () => {
  installTestDatabase();
  const saved = await writeThemeSettings({
    activeTheme: "metallic-chic",
    presets: presetsRecord({ "metallic-chic": { primary: "bad-hex" } }),
  });
  assert.equal(
    saved.presets["metallic-chic"]?.colors.primary,
    getDefaultThemePreset("metallic-chic").primary,
  );
});

test("writeThemeSettings throws when no database is configured", async () => {
  delete scope.prisma;
  await assert.rejects(
    () => writeThemeSettings({ activeTheme: "metallic-chic", presets: presetsRecord() }),
    /configured database/,
  );
});

test("readThemeSettingsWithSource reports whether values came from the database", async () => {
  // No DB -> defaults with source "defaults".
  delete scope.prisma;
  const fallback = await readThemeSettingsWithSource();
  assert.equal(fallback.source, "defaults");

  // DB present and row written -> database source.
  installTestDatabase();
  await writeThemeSettings({
    activeTheme: "snowy-yet-warm",
    presets: presetsRecord(),
  });
  const fromDb = await readThemeSettingsWithSource();
  assert.equal(fromDb.source, "database");
  assert.equal(fromDb.settings.activeTheme, "snowy-yet-warm");
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
    buttonForeground: "#AAAAAA",
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
    body: JSON.stringify({ activeTheme: "metallic-chic", presets: presetsRecord() }),
  }));
  assert.equal(response.status, 403);
});

test("theme API: authorized GET returns the persisted theme with database source", async (context) => {
  installTestDatabase();
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { GET } = await loadThemeRoute();
  const response = await GET();
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: ThemeSettings;
    success: boolean;
    source?: string;
  };
  assert.equal(body.success, true);
  assert.equal(body.source, "database");
  assert.deepEqual(Object.keys(body.data.presets).sort(), [...THEME_PRESET_IDS].sort());
});

test("theme API: authorized GET reports mock source when the database is unreachable", async (context) => {
  // No DB installed -> the read falls back to defaults; the source must say so.
  delete scope.prisma;
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { GET } = await loadThemeRoute();
  const response = await GET();
  assert.equal(response.status, 200);
  const body = (await response.json()) as { success: boolean; source?: string };
  assert.equal(body.success, true);
  assert.equal(body.source, "mock");
});

test("theme API: authorized PUT saves the active theme and presets", async (context) => {
  installTestDatabase();
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { PUT } = await loadThemeRoute();
  const response = await PUT(new NextRequest("http://localhost:3000/api/admin/settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeTheme: "rose-red-and-blueberry", presets: presetsRecord() }),
  }));
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: ThemeSettings;
    success: boolean;
    source?: string;
  };
  assert.equal(body.success, true);
  assert.equal(body.data.activeTheme, "rose-red-and-blueberry");
  assert.equal(body.source, "database");

  // Persisted and retrievable on a fresh read.
  const reloaded = await readThemeSettings();
  assert.equal(reloaded.activeTheme, "rose-red-and-blueberry");
});

test("theme API: authorized PUT rejects an invalid HEX payload with 400", async (context) => {
  installTestDatabase();
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { PUT } = await loadThemeRoute();
  const badPresets = presetsRecord({
    "metallic-chic": { primary: "not-a-color" },
  });
  const response = await PUT(new NextRequest("http://localhost:3000/api/admin/settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeTheme: "metallic-chic", presets: badPresets }),
  }));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { success: boolean; error: string };
  assert.equal(body.success, false);
  assert.ok(body.error.length > 0);
});

test("theme API: authorized PUT returns 503 with an actionable message when the database is unreachable", async (context) => {
  // No DB -> writeThemeSettings throws; the route must report the failure
  // clearly rather than implying the save succeeded.
  delete scope.prisma;
  context.mock.module("../lib/auth", { namedExports: ADMIN_GATE });
  const { PUT } = await loadThemeRoute();
  const response = await PUT(new NextRequest("http://localhost:3000/api/admin/settings/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeTheme: "metallic-chic", presets: presetsRecord() }),
  }));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { success: boolean; error: string };
  assert.equal(body.success, false);
  assert.match(body.error, /database|unreachable/i);
});
