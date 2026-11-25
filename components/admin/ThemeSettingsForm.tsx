"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Palette, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AdminField,
  FormSection,
  adminButtonBlue,
  adminButtonGhost,
  adminInputClass,
} from "@/components/admin/Field";
import { ThemePreview } from "@/components/theme/ThemePreview";
import {
  DEFAULT_THEME_PRESETS,
  THEME_PRESET_IDS,
  THEME_PRESET_LABELS,
  getDefaultThemePreset,
  isValidHex,
  type ThemeColors,
  type ThemePresetId,
  type ThemeSettings,
} from "@/lib/theme-settings";
import type { ApiResponse } from "@/types";

/** The ten editable colors, in display order. */
const COLOR_FIELDS: ReadonlyArray<{ key: keyof ThemeColors; label: string }> = [
  { key: "primary", label: "Primary Color" },
  { key: "secondary", label: "Secondary Color" },
  { key: "accent", label: "Accent Color" },
  { key: "background", label: "Main Background" },
  { key: "surface", label: "Surface / Card Background" },
  { key: "foreground", label: "Primary Text Color" },
  { key: "mutedForeground", label: "Secondary Text Color" },
  { key: "border", label: "Border Color" },
  { key: "buttonBg", label: "Button Background" },
  { key: "buttonForeground", label: "Button Text Color" },
];

/** One color picker: native swatch + manual HEX input, with validation. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const valid = isValidHex(value);
  const inputId = `theme-color-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <AdminField
      label={label}
      htmlFor={inputId}
      error={!valid ? "Use a valid HEX color (e.g. #1A2B3C)" : undefined}
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#151515] p-1"
        />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="#1A2B3C"
          className={adminInputClass}
        />
      </div>
    </AdminField>
  );
}

export function ThemeSettingsForm() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ThemeSettings | null>(null);
  const [loadedFromDatabase, setLoadedFromDatabase] = useState(true);
  const [selected, setSelected] = useState<ThemePresetId>("metallic-chic");
  const [draft, setDraft] = useState<ThemeColors>(
    getDefaultThemePreset("metallic-chic"),
  );
  const [showPreview, setShowPreview] = useState(true);

  // Load the persisted theme once mounted (client fetch, like the hero editor).
  useEffect(() => {
    setMounted(true);
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/admin/settings/theme", {
          cache: "no-store",
        });
        if (!response.ok) {
          if (active) setLoadError("Could not load theme settings.");
          return;
        }
        const json = (await response.json()) as ApiResponse<ThemeSettings>;
        if (!active || !json.success || !json.data) {
          if (active) setLoadError("Could not load theme settings.");
          return;
        }
        // `source: "mock"` means the values are fail-safe defaults because the
        // database could not be read — never present them as saved values.
        setLoadedFromDatabase(json.source === "database");
        setSettings(json.data);
        setSelected(json.data.activeTheme);
        setDraft(json.data.presets[json.data.activeTheme] as ThemeColors);
      } catch {
        if (active) setLoadError("Could not load theme settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectPreset = (id: ThemePresetId) => {
    setSelected(id);
    setDraft(
      settings
        ? (settings.presets[id] as ThemeColors)
        : getDefaultThemePreset(id),
    );
  };

  const updateColor = (key: keyof ThemeColors, next: string) => {
    setDraft((current) => ({ ...current, [key]: next }));
  };

  /** Builds the full payload, applying the current draft to the selected preset. */
  const buildPayload = (): ThemeSettings => {
    // Start from each preset's defaults and layer any saved customizations on
    // top, so independent customizations are preserved and no preset is lost.
    const basePresets: Record<string, ThemeColors> = {};
    for (const preset of DEFAULT_THEME_PRESETS) {
      const saved = settings?.presets?.[preset.id] ?? {};
      basePresets[preset.id] = { ...preset.colors, ...saved };
    }
    return {
      activeTheme: selected,
      presets: {
        ...basePresets,
        [selected]: draft,
      },
    };
  };

  const persist = async (payload: ThemeSettings, successMessage: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as ApiResponse<ThemeSettings>;
      if (!response.ok || !json.success || !json.data) {
        toast.error("Could not save theme settings", {
          description: json.error ?? "Please try again.",
        });
        return;
      }
      const saved = json.data;
      setSettings(saved);
      setSelected(saved.activeTheme);
      setDraft(saved.presets[saved.activeTheme] as ThemeColors);
      setLoadedFromDatabase(true);
      toast.success(successMessage);
    } catch {
      toast.error("Could not save theme settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = () => {
    void persist(buildPayload(), "Theme applied to the storefront.");
  };

  const handleReset = () => {
    setDraft(getDefaultThemePreset(selected));
    void persist(buildPayload(), `${THEME_PRESET_LABELS[selected]} reset to defaults.`);
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Loading theme settings…
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <p role="alert" className="text-sm text-rose">
        {loadError ?? "Could not load theme settings."}
      </p>
    );
  }

  const isActive = settings.activeTheme === selected;

  return (
    <div className="flex flex-col gap-5">
      {!loadedFromDatabase && (
        <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          The database could not be read, so the values shown are the built-in
          defaults — they are <strong>not</strong> the saved theme. Fix database
          connectivity and refresh to load your saved theme.
        </p>
      )}
      <FormSection
        title="Theme Presets"
        description="Choose a preset to customize, preview, and apply. Each preset is customized independently."
      >
        <div className="flex flex-wrap gap-2">
          {THEME_PRESET_IDS.map((id) => {
            const active = id === selected;
            const live = settings.activeTheme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectPreset(id)}
                className={
                  active
                    ? "inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white"
                    : "inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                <Palette aria-hidden className="size-3.5" />
                {THEME_PRESET_LABELS[id]}
                {live && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-normal opacity-90">
                    <Check aria-hidden className="size-3" /> live
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FormSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection
          title={`${THEME_PRESET_LABELS[selected]} — Colors`}
          description="Edit the ten colors. Changes apply to the preview immediately; use Apply Theme to make them live."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map(({ key, label }) => (
              <ColorField
                key={key}
                label={label}
                value={draft[key]}
                onChange={(next) => updateColor(key, next)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={saving}
              className={adminButtonBlue}
            >
              {saving ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden className="size-4" />
              )}
              Apply Theme
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className={adminButtonGhost}
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset to Default
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className={adminButtonGhost}
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            {isActive && (
              <span className="text-[11px] text-emerald-400">
                Currently live on the storefront
              </span>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Live Preview"
          description="A representative storefront mockup using the current colors. Previewing never changes the live storefront."
        >
          {showPreview ? (
            <ThemePreview colors={draft} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Preview is hidden. Click “Show Preview” to see the current colors.
            </p>
          )}
        </FormSection>
      </div>
    </div>
  );
}
