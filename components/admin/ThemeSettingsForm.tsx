"use client";

import { useEffect, useMemo, useState } from "react";
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
  FONT_FAMILY_OPTIONS,
  THEME_PRESET_IDS,
  THEME_PRESET_LABELS,
  getDefaultDesignConfig,
  getDefaultThemePreset,
  isValidHex,
  type DesignGroupKey,
  type ThemeColors,
  type ThemePresetId,
  type ThemePresetState,
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

/* -------------------------------------------------------------------------- */
/*  Design field metadata                                                     */
/* -------------------------------------------------------------------------- */

type DesignFieldType = "number" | "select" | "text";

interface DesignFieldDef {
  key: string;
  label: string;
  type: DesignFieldType;
  options?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
}

interface DesignGroupDef {
  group: DesignGroupKey;
  title: string;
  description: string;
  fields: DesignFieldDef[];
}

const DESIGN_GROUPS: readonly DesignGroupDef[] = [
  {
    group: "typography",
    title: "Typography",
    description: "Fonts, weights, sizes and rhythm for the storefront.",
    fields: [
      { key: "headingFont", label: "Heading Font", type: "select", options: FONT_FAMILY_OPTIONS },
      { key: "bodyFont", label: "Body Font", type: "select", options: FONT_FAMILY_OPTIONS },
      { key: "headingWeight", label: "Heading Weight", type: "number", min: 100, max: 900, step: 100 },
      { key: "bodyWeight", label: "Body Weight", type: "number", min: 100, max: 900, step: 100 },
      { key: "baseFontSize", label: "Base Font Size", type: "text" },
      { key: "headingScale", label: "Heading Scale", type: "number", min: 1, max: 4, step: 0.1 },
      { key: "bodyLineHeight", label: "Body Line Height", type: "number", min: 1, max: 3, step: 0.05 },
      { key: "headingLineHeight", label: "Heading Line Height", type: "number", min: 1, max: 3, step: 0.05 },
      { key: "letterSpacing", label: "Letter Spacing", type: "text" },
    ],
  },
  {
    group: "radius",
    title: "Radius",
    description: "Border radius language across the storefront.",
    fields: [
      { key: "sm", label: "Small", type: "text" },
      { key: "md", label: "Medium", type: "text" },
      { key: "lg", label: "Large", type: "text" },
      { key: "card", label: "Card", type: "text" },
      { key: "button", label: "Button", type: "text" },
      { key: "input", label: "Input", type: "text" },
    ],
  },
  {
    group: "shadows",
    title: "Shadows",
    description: "Elevation and depth for cards, buttons and surfaces.",
    fields: [
      { key: "sm", label: "Small", type: "text" },
      { key: "md", label: "Medium", type: "text" },
      { key: "lg", label: "Large", type: "text" },
      { key: "card", label: "Card", type: "text" },
      { key: "button", label: "Button", type: "text" },
    ],
  },
  {
    group: "borders",
    title: "Borders",
    description: "Border thickness and style.",
    fields: [
      { key: "width", label: "Width", type: "text" },
      {
        key: "style",
        label: "Style",
        type: "select",
        options: ["solid", "dashed", "dotted"],
      },
    ],
  },
  {
    group: "header",
    title: "Header & Navigation",
    description: "Header look, nav typography and link appearance.",
    fields: [
      { key: "style", label: "Header Style", type: "select", options: ["solid", "glass", "transparent"] },
      { key: "bg", label: "Header Background", type: "text" },
      { key: "navFontSize", label: "Nav Font Size", type: "text" },
      { key: "navSpacing", label: "Nav Spacing", type: "text" },
      { key: "borderStyle", label: "Header Border", type: "select", options: ["border", "shadow", "none"] },
      { key: "navLinkStyle", label: "Nav Link Style", type: "select", options: ["underline", "pill", "plain"] },
    ],
  },
  {
    group: "buttons",
    title: "Buttons",
    description: "Shape, size, hover and primary/secondary styles.",
    fields: [
      { key: "shape", label: "Shape", type: "select", options: ["pill", "rounded", "sharp"] },
      { key: "radius", label: "Radius", type: "text" },
      { key: "height", label: "Height", type: "text" },
      { key: "paddingX", label: "Horizontal Padding", type: "text" },
      { key: "paddingY", label: "Vertical Padding", type: "text" },
      { key: "fontWeight", label: "Font Weight", type: "number", min: 100, max: 900, step: 100 },
      { key: "fontSize", label: "Font Size", type: "text" },
      { key: "hoverStyle", label: "Hover Style", type: "select", options: ["lift", "glow", "fill", "none"] },
      { key: "transition", label: "Transition", type: "text" },
      { key: "primaryStyle", label: "Primary Style", type: "select", options: ["solid", "outline", "gradient"] },
      { key: "secondaryStyle", label: "Secondary Style", type: "select", options: ["solid", "outline", "ghost"] },
    ],
  },
  {
    group: "cards",
    title: "Product Cards",
    description: "Card layout, borders, shadows, typography and hover.",
    fields: [
      { key: "radius", label: "Radius", type: "text" },
      { key: "border", label: "Border", type: "select", options: ["none", "hairline", "strong"] },
      { key: "shadow", label: "Shadow", type: "select", options: ["none", "sm", "md", "lg"] },
      { key: "imageStyle", label: "Image Style", type: "select", options: ["contain", "cover", "rounded"] },
      { key: "titleSize", label: "Title Size", type: "text" },
      { key: "priceSize", label: "Price Size", type: "text" },
      { key: "badgeStyle", label: "Badge Style", type: "select", options: ["pill", "sharp", "rounded"] },
      { key: "padding", label: "Padding", type: "text" },
      { key: "hover", label: "Hover", type: "select", options: ["lift", "glow", "none"] },
    ],
  },
  {
    group: "layout",
    title: "Layout & Spacing",
    description: "Container width, section spacing and grid density.",
    fields: [
      { key: "containerWidth", label: "Container Width", type: "text" },
      { key: "sectionSpacing", label: "Section Spacing", type: "text" },
      { key: "pagePaddingX", label: "Page Horizontal Padding", type: "text" },
      { key: "gridGap", label: "Grid Gap", type: "text" },
      { key: "gridCols", label: "Grid Columns", type: "number", min: 2, max: 6, step: 1 },
      { key: "cardGap", label: "Card Gap", type: "text" },
      { key: "headingSpacing", label: "Heading Spacing", type: "text" },
    ],
  },
  {
    group: "footer",
    title: "Footer",
    description: "Footer background, text, spacing and links.",
    fields: [
      { key: "bg", label: "Background", type: "text" },
      { key: "textColor", label: "Text Color", type: "text" },
      { key: "spacing", label: "Spacing", type: "text" },
      { key: "border", label: "Border", type: "select", options: ["none", "hairline", "strong"] },
      { key: "linkStyle", label: "Link Style", type: "select", options: ["underline", "plain", "hover"] },
    ],
  },
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

/** A single design-token control. */
function DesignField({
  label,
  value,
  type,
  options,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | string;
  type: DesignFieldType;
  options?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number | string) => void;
}) {
  const inputId = `theme-design-${label.replace(/\s+/g, "-").toLowerCase()}`;

  if (type === "select" && options) {
    return (
      <AdminField label={label} htmlFor={inputId}>
        <select
          id={inputId}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          className={adminInputClass}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </AdminField>
    );
  }

  if (type === "number") {
    return (
      <AdminField label={label} htmlFor={inputId}>
        <input
          id={inputId}
          type="number"
          value={typeof value === "number" ? value : Number(value)}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className={adminInputClass}
        />
      </AdminField>
    );
  }

  return (
    <AdminField label={label} htmlFor={inputId}>
      <input
        id={inputId}
        type="text"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        className={adminInputClass}
      />
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
  const [draft, setDraft] = useState<ThemePresetState>({
    colors: getDefaultThemePreset("metallic-chic"),
    design: getDefaultDesignConfig("metallic-chic"),
  });
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
        setDraft(
          (json.data.presets[json.data.activeTheme] as ThemePresetState | undefined) ?? {
            colors: getDefaultThemePreset(json.data.activeTheme),
            design: getDefaultDesignConfig(json.data.activeTheme),
          },
        );
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
        ? (settings.presets[id] as ThemePresetState | undefined) ?? {
            colors: getDefaultThemePreset(id),
            design: getDefaultDesignConfig(id),
          }
        : {
            colors: getDefaultThemePreset(id),
            design: getDefaultDesignConfig(id),
          },
    );
  };

  const updateColor = (key: keyof ThemeColors, next: string) => {
    setDraft((current) => ({ ...current, colors: { ...current.colors, [key]: next } }));
  };

  const updateDesign = (group: DesignGroupKey, key: string, next: number | string) => {
    setDraft((current) => ({
      ...current,
      design: {
        ...current.design,
        [group]: {
          ...((current.design[group] as unknown) as Record<string, number | string>),
          [key]: next,
        },
      },
    }));
  };

  /** Builds the full payload, applying the current draft to the selected preset
   *  while preserving every other preset's saved colors and design. */
  const buildPayload = (): ThemeSettings => {
    const basePresets: Record<string, ThemePresetState> = {};
    for (const preset of DEFAULT_THEME_PRESETS) {
      const saved = settings?.presets?.[preset.id];
      basePresets[preset.id] = {
        colors: { ...preset.colors, ...(saved?.colors ?? {}) },
        design: { ...preset.design, ...(saved?.design ?? {}) },
      };
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
      const nextDraft =
        (saved.presets[saved.activeTheme] as ThemePresetState | undefined) ?? {
          colors: getDefaultThemePreset(saved.activeTheme),
          design: getDefaultDesignConfig(saved.activeTheme),
        };
      setDraft(nextDraft);
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
    setDraft({
      colors: getDefaultThemePreset(selected),
      design: getDefaultDesignConfig(selected),
    });
    void persist(buildPayload(), `${THEME_PRESET_LABELS[selected]} reset to defaults.`);
  };

  // Unsaved-changes indicator: does the draft differ from the saved selection?
  const hasUnsavedChanges = useMemo(() => {
    if (!settings) return false;
    const saved = settings.presets[selected];
    if (!saved) return true;
    return (
      JSON.stringify(draft.colors) !== JSON.stringify(saved.colors) ||
      JSON.stringify(draft.design) !== JSON.stringify(saved.design)
    );
  }, [draft, settings, selected]);

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
        description="Choose a complete design preset to customize, preview, and apply. Each preset is customized independently — selecting one never changes the live storefront until you apply it."
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
        <div className="flex flex-col gap-5">
          <FormSection
            title={`${THEME_PRESET_LABELS[selected]} — Colors`}
            description="Edit the ten colors. Changes apply to the preview immediately; use Apply Theme to make them live."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {COLOR_FIELDS.map(({ key, label }) => (
                <ColorField
                  key={key}
                  label={label}
                  value={draft.colors[key]}
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
              {hasUnsavedChanges && (
                <span className="text-[11px] text-amber-400">Unsaved changes</span>
              )}
              {isActive && !hasUnsavedChanges && (
                <span className="text-[11px] text-emerald-400">
                  Currently live on the storefront
                </span>
              )}
            </div>
          </FormSection>

          {/* Design customization — scrollable so the form stays usable. */}
          <div className="max-h-[720px] overflow-y-auto pr-1">
            {DESIGN_GROUPS.map((def) => (
              <FormSection
                key={def.group}
                title={def.title}
                description={def.description}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {def.fields.map((field) => {
                    const fieldValue = (
                      draft.design[def.group] as unknown as Record<
                        string,
                        number | string
                      >
                    )[field.key] ?? "";
                    return (
                      <DesignField
                        key={field.key}
                        label={field.label}
                        type={field.type}
                        options={field.options}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={fieldValue}
                        onChange={(next) =>
                          updateDesign(def.group, field.key, next)
                        }
                      />
                    );
                  })}
                </div>
              </FormSection>
            ))}
          </div>
        </div>

        <FormSection
          title="Live Preview"
          description="A representative storefront using the current design. Previewing never changes the live storefront or saves anything."
        >
          {showPreview ? (
            <ThemePreview colors={draft.colors} design={draft.design} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Preview is hidden. Click “Show Preview” to see the current design.
            </p>
          )}
        </FormSection>
      </div>
    </div>
  );
}
