"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminField, FormSection, adminButtonBlue, adminInputClass, adminSelectClass } from "@/components/admin/Field";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { useMediaSession } from "@/hooks/useMediaSession";
import { DEFAULT_HERO_SETTINGS, type HeroSettings } from "@/lib/hero-settings";
import { mediaKindFromUrl } from "@/lib/images";
import { settingsHeroSchema, type SettingsHeroValues } from "@/lib/validations";
import type { ApiResponse } from "@/types";

const EMPTY_FORM: SettingsHeroValues = {
  heroTitle: "",
  heroSubtitle: "",
  heroBadgeText: "",
  heroMediaUrl: "",
  heroMediaType: "video",
  primaryCtaText: "",
  primaryCtaLink: "",
  secondaryCtaText: "",
  secondaryCtaLink: "",
};

function toFormValues(settings: HeroSettings): SettingsHeroValues {
  return {
    heroTitle: settings.heroTitle ?? "",
    heroSubtitle: settings.heroSubtitle ?? "",
    heroBadgeText: settings.heroBadgeText ?? "",
    heroMediaUrl: settings.heroMediaUrl ?? "",
    heroMediaType: settings.heroMediaType,
    primaryCtaText: settings.primaryCtaText ?? "",
    primaryCtaLink: settings.primaryCtaLink ?? "",
    secondaryCtaText: settings.secondaryCtaText ?? "",
    secondaryCtaLink: settings.secondaryCtaLink ?? "",
  };
}

/**
 * Homepage hero editor.
 *
 * Image backgrounds upload through `ImageUpload` into Cloudinary's
 * `mukra/banners` folder (served as AVIF/WebP by `OptimizedImage`); a replaced
 * banner is deleted server-side after the save. Video backgrounds keep the URL
 * field and the hero video uploader (`/api/upload?purpose=hero`).
 */
export function HeroSettingsForm() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const media = useMediaSession();
  const [imageUploading, setImageUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsHeroValues>({
    resolver: zodResolver(settingsHeroSchema),
    defaultValues: EMPTY_FORM,
  });
  const mediaType = watch("heroMediaType");
  const mediaUrl = watch("heroMediaUrl") ?? "";
  /* A saved video URL can't preview as an image — show an empty picker instead. */
  const savedVideoInImageMode = mediaType === "image" && mediaKindFromUrl(mediaUrl) === "video";

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings/hero", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as ApiResponse<HeroSettings>;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "Could not load hero settings");
        }
        reset(toFormValues(result.data));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Could not load hero settings");
        reset(toFormValues(DEFAULT_HERO_SETTINGS));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadSettings();
    return () => controller.abort();
  }, [reset]);

  async function save(values: SettingsHeroValues) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as ApiResponse<HeroSettings>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Could not save hero settings");
      }
      // The saved banner is the hero's now; other uploads from this visit go.
      media.commit([values.heroMediaUrl]);
      reset(toFormValues(result.data));
      setLoadError(null);
      toast.success("Hero settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save hero settings");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadName(file.name);

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload?purpose=hero", { method: "POST", body: form });
      const result = (await response.json()) as ApiResponse<{ url: string; kind: "image" | "video" }>;
      if (!response.ok || !result.success || !result.data?.url) {
        throw new Error(result.error ?? "Could not upload hero media");
      }

      setValue("heroMediaUrl", result.data.url, { shouldDirty: true, shouldValidate: true });
      setValue("heroMediaType", result.data.kind, { shouldDirty: true, shouldValidate: true });
      toast.success("Hero media uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload hero media");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        aria-live="polite"
        className="min-h-40 text-xs text-muted-foreground"
      >
        Loading hero settings…
      </div>
    );
  }

  return (
    <div suppressHydrationWarning>
    <form
      suppressHydrationWarning
      onSubmit={handleSubmit(save)}
      className="flex flex-col gap-6"
    >
      <FormSection
        title="Hero content"
        description="Leave text fields blank to keep the storefront's current language-aware copy."
      >
        <AdminField label="Hero title" htmlFor="hero-title" error={errors.heroTitle?.message}>
          <input suppressHydrationWarning id="hero-title" {...register("heroTitle")} className={adminInputClass} />
        </AdminField>
        <AdminField label="Badge text" htmlFor="hero-badge" error={errors.heroBadgeText?.message}>
          <input suppressHydrationWarning id="hero-badge" {...register("heroBadgeText")} className={adminInputClass} />
        </AdminField>
        <AdminField
          label="Hero subtitle"
          htmlFor="hero-subtitle"
          error={errors.heroSubtitle?.message}
          className="sm:col-span-2"
        >
          <textarea
            suppressHydrationWarning
            id="hero-subtitle"
            rows={3}
            {...register("heroSubtitle")}
            className={`${adminInputClass} h-auto resize-y`}
          />
        </AdminField>
      </FormSection>

      <FormSection
        title="Background media"
        description="Images upload to Cloudinary (mukra/banners) and are served as AVIF/WebP. Videos use a URL or the video uploader."
      >
        <AdminField label="Media type" htmlFor="hero-media-type" error={errors.heroMediaType?.message}>
          <select suppressHydrationWarning id="hero-media-type" {...register("heroMediaType")} className={adminSelectClass}>
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </AdminField>

        {mediaType === "image" ? (
          <AdminField
            label="Banner image"
            htmlFor="hero-banner-image"
            error={errors.heroMediaUrl?.message}
            hint={
              savedVideoInImageMode
                ? "The saved background is a video — upload an image to replace it."
                : "Wide landscape photos (16:9, 1920px or wider) look best."
            }
            className="sm:col-span-2"
          >
            <ImageUpload
              id="hero-banner-image"
              label="Banner image"
              folder="banners"
              aspect="banner"
              value={savedVideoInImageMode ? "" : mediaUrl}
              onChange={(url) => setValue("heroMediaUrl", url, { shouldDirty: true, shouldValidate: true })}
              session={media}
              onUploadingChange={setImageUploading}
              invalid={Boolean(errors.heroMediaUrl)}
              disabled={loading}
              sizes="(min-width: 1024px) 720px, 100vw"
            />
          </AdminField>
        ) : (
          <>
            <AdminField
              label="Video URL"
              htmlFor="hero-media-url"
              error={errors.heroMediaUrl?.message}
              hint="An http(s) URL or a local public path. Leave blank to use the bundled hero video."
            >
              <input
                suppressHydrationWarning
                id="hero-media-url"
                type="text"
                {...register("heroMediaUrl")}
                className={adminInputClass}
              />
            </AdminField>
            <AdminField
              label="Upload video"
              htmlFor="hero-media-file"
              hint="MP4 or WebM, up to 100MB. Uploading replaces the video URL."
            >
              <input
                suppressHydrationWarning
                ref={fileInput}
                id="hero-media-file"
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                className="sr-only"
                disabled={uploading || loading}
                onChange={(event) => {
                  void uploadMedia(event.target.files?.[0]);
                }}
              />
              <button
                type="button"
                disabled={uploading || loading}
                onClick={() => fileInput.current?.click()}
                className={`${adminButtonBlue} min-h-10 w-fit px-3`}
              >
                {uploading ? (
                  <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                ) : (
                  <Upload aria-hidden className="size-3.5" />
                )}
                {uploading ? `Uploading ${uploadName ?? "video"}…` : "Choose video"}
              </button>
            </AdminField>
          </>
        )}
      </FormSection>

      <FormSection title="Call-to-action buttons">
        <AdminField
          label="Primary button text"
          htmlFor="hero-primary-text"
          error={errors.primaryCtaText?.message}
        >
          <input suppressHydrationWarning id="hero-primary-text" {...register("primaryCtaText")} className={adminInputClass} />
        </AdminField>
        <AdminField
          label="Primary button link"
          htmlFor="hero-primary-link"
          error={errors.primaryCtaLink?.message}
        >
          <input suppressHydrationWarning id="hero-primary-link" {...register("primaryCtaLink")} className={adminInputClass} />
        </AdminField>
        <AdminField
          label="Secondary button text"
          htmlFor="hero-secondary-text"
          error={errors.secondaryCtaText?.message}
        >
          <input
            suppressHydrationWarning
            id="hero-secondary-text"
            {...register("secondaryCtaText")}
            className={adminInputClass}
          />
        </AdminField>
        <AdminField
          label="Secondary button link"
          htmlFor="hero-secondary-link"
          error={errors.secondaryCtaLink?.message}
        >
          <input
            suppressHydrationWarning
            id="hero-secondary-link"
            {...register("secondaryCtaLink")}
            className={adminInputClass}
          />
        </AdminField>
      </FormSection>

      {loadError && (
        <p role="alert" className="text-xs text-rose">
          {loadError}
        </p>
      )}

      <div className="flex justify-end border-t border-[#242424] pt-4">
        <button
          type="submit"
          disabled={loading || saving || uploading || imageUploading}
          className={`${adminButtonBlue} min-h-11 sm:min-h-10`}
        >
          <Save aria-hidden className="size-3.5" />
          {saving
            ? "Saving…"
            : loading
              ? "Loading…"
              : uploading || imageUploading
                ? "Uploading…"
                : "Save Hero Settings"}
        </button>
      </div>
    </form>
    </div>
  );
}
