"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImageOff, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { adminButtonGhost } from "@/components/admin/Field";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import type { MediaSession } from "@/hooks/useMediaSession";
import { isUploadAbort, uploadAdminImage } from "@/lib/admin-upload-client";
import { humanFileSize } from "@/lib/images";
import {
  MEDIA_ACCEPT,
  MEDIA_FOLDERS,
  MEDIA_MAX_BYTES,
  MEDIA_TYPES_LABEL,
  validateMediaFile,
  type MediaFolder,
} from "@/lib/media";
import { cn } from "@/lib/utils";
import type { AdminUploadResult } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Upload state                                                              */
/* -------------------------------------------------------------------------- */

interface UploaderState {
  uploading: boolean;
  /** 0–100 across the byte transfer. */
  progress: number;
  /** All bytes sent — Cloudinary is storing/optimising the image. */
  processing: boolean;
  /** Object URL of the file being uploaded, for an instant local preview. */
  preview: string | null;
}

const IDLE: UploaderState = { uploading: false, progress: 0, processing: false, preview: null };

export interface UseImageUploaderOptions {
  folder: MediaFolder;
  /** Max bytes (clamped to the 5 MB server limit). */
  maxSize?: number;
  /** Tracks uploads so abandoned ones get deleted (see `useMediaSession`). */
  session?: MediaSession;
  /** Fires `true` when an upload starts and `false` when it settles. */
  onUploadingChange?: (uploading: boolean) => void;
}

/** "Saved to mukra/products · 1600×2000 · 482 KB" — success toast copy. */
export function describeUpload(asset: AdminUploadResult, folder: MediaFolder): string {
  const where = asset.publicId.startsWith("local:")
    ? "Stored on this server (Cloudinary isn't configured)"
    : `Saved to ${MEDIA_FOLDERS[folder]}`;
  const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
  return [where, dimensions, humanFileSize(asset.size)].filter(Boolean).join(" · ");
}

/**
 * One upload at a time against `/api/admin/upload`: validates in the browser
 * first (instant toast for a PDF or a 6 MB photo), then streams the file with
 * progress, a local preview and cancellation. Unmounting aborts the request.
 */
export function useImageUploader({
  folder,
  maxSize = MEDIA_MAX_BYTES,
  session,
  onUploadingChange,
}: UseImageUploaderOptions) {
  const [state, setState] = useState<UploaderState>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const busyCallback = useRef(onUploadingChange);

  useEffect(() => {
    busyCallback.current = onUploadingChange;
  }, [onUploadingChange]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const upload = useCallback(
    async (file: File, options: { quiet?: boolean } = {}): Promise<AdminUploadResult | null> => {
      const check = validateMediaFile(file, maxSize);
      if (!check.ok) {
        toast.error("Image not uploaded", { description: check.error });
        return null;
      }

      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const preview = URL.createObjectURL(file);
      setState({ uploading: true, progress: 0, processing: false, preview });
      busyCallback.current?.(true);

      try {
        const asset = await uploadAdminImage(file, folder, {
          signal: current.signal,
          onProgress: ({ percent, processing }) => {
            if (!mounted.current) return;
            setState((previous) => (previous.uploading ? { ...previous, progress: percent, processing } : previous));
          },
        });
        session?.track(asset);
        if (!options.quiet) {
          toast.success("Image uploaded", { description: describeUpload(asset, folder) });
        }
        return asset;
      } catch (error) {
        if (isUploadAbort(error)) {
          if (mounted.current) toast.info("Upload cancelled", { description: file.name });
          return null;
        }
        toast.error(`Couldn't upload ${file.name}`, {
          description: error instanceof Error ? error.message : "Please try again.",
        });
        return null;
      } finally {
        URL.revokeObjectURL(preview);
        if (controller.current === current) controller.current = null;
        if (mounted.current) setState(IDLE);
        busyCallback.current?.(false);
      }
    },
    [folder, maxSize, session],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { ...state, upload, cancel };
}

/* -------------------------------------------------------------------------- */
/*  Drag & drop                                                               */
/* -------------------------------------------------------------------------- */

function hasFiles(event: React.DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * Drag-and-drop handlers for a file target. Counts enter/leave pairs so
 * moving across child elements doesn't flicker the highlight.
 */
export function useFileDrop(onFiles: (files: File[]) => void, disabled = false) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const dropProps = {
    onDragEnter(event: React.DragEvent<HTMLElement>) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver(event: React.DragEvent<HTMLElement>) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    onDragLeave(event: React.DragEvent<HTMLElement>) {
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(event: React.DragEvent<HTMLElement>) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
  };

  return { dragging: dragging && !disabled, dropProps };
}

/** Image files from a paste event (screenshots, copied images). */
export function filesFromPaste(event: React.ClipboardEvent<HTMLElement>): File[] {
  return Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
}

/* -------------------------------------------------------------------------- */
/*  Shared pieces                                                             */
/* -------------------------------------------------------------------------- */

/** Spinner, percentage, progress bar and Cancel — laid over the preview. */
export function UploadOverlay({
  progress,
  processing,
  onCancel,
  compact = false,
  caption,
}: {
  progress: number;
  processing: boolean;
  onCancel: () => void;
  compact?: boolean;
  /** Extra context, e.g. "2/3" during a batch. */
  caption?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0B0B0B]/70 p-2 text-center backdrop-blur-[2px]">
      <Loader2 aria-hidden className={cn("animate-spin text-blue-300", compact ? "size-4" : "size-5")} />
      <p className={cn("font-medium text-foreground tabular-nums", compact ? "text-[10px]" : "text-xs")}>
        {processing ? "Optimizing…" : `Uploading ${progress}%`}
        {caption ? <span className="text-muted-foreground"> · {caption}</span> : null}
      </p>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", compact ? "max-w-20" : "max-w-48")}
      >
        <div
          className={cn(
            "h-full rounded-full bg-blue-500 transition-[width] duration-200",
            processing && "animate-pulse",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
      >
        <X aria-hidden className="size-3" />
        Cancel
      </button>
    </div>
  );
}

/** Small square icon button used on gallery tiles. */
export function TileButton({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md border border-[#2A2A2A] bg-[#0D0D0D]/85 text-muted-foreground backdrop-blur-sm transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" && "hover:text-rose-400",
      )}
    >
      {children}
    </button>
  );
}

function PreviewUnavailable({ compact }: { compact: boolean }) {
  return (
    <div className="grid h-full w-full place-items-center bg-linear-to-br from-blue-500/15 to-violet-500/10">
      <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
        <ImageOff aria-hidden className="size-4" />
        {!compact && "Preview unavailable"}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ImageUpload                                                               */
/* -------------------------------------------------------------------------- */

const ASPECT_CLASSES = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[4/3]",
  banner: "aspect-video",
} as const;

export interface ImageUploadProps {
  /** Current image URL. Empty/`null` shows the drop zone. */
  value?: string | null;
  /** Receives the uploaded image's URL, or `""` after Remove. */
  onChange: (url: string) => void;
  /** Destination (`products` | `categories` | `banners`) — the API checks the role against it. */
  folder: MediaFolder;
  /** Max file size in bytes. Defaults to — and can't exceed — 5 MB. */
  maxSize?: number;
  /** Form-level upload tracking, so abandoned uploads are deleted. */
  session?: MediaSession;
  /** Full API payload (`url`, `publicId`, `width`, `height`, `format`, `size`). */
  onUploaded?: (asset: AdminUploadResult) => void;
  /** Lets a form hold its Save button while an upload is in flight. */
  onUploadingChange?: (uploading: boolean) => void;
  /** Id of the hidden file input — an external `<label htmlFor>` opens the picker. */
  id?: string;
  /** Accessible name, e.g. "Category cover". */
  label?: string;
  /** Extra hint after the type/size line. */
  hint?: string;
  /** Preview frame shape (default `landscape`, 4:3). */
  aspect?: keyof typeof ASPECT_CLASSES;
  /** Compact square tile (gallery layout): icon buttons instead of a toolbar. */
  compact?: boolean;
  /** Corner badge on the preview, e.g. "Cover". */
  badge?: string;
  /** Extra controls next to Replace/Remove. */
  actions?: React.ReactNode;
  /** Shown when `value` isn't a loadable image (e.g. a legacy placeholder token). */
  placeholder?: React.ReactNode;
  /** `sizes` for the preview image. */
  sizes?: string;
  disabled?: boolean;
  /** Draws the error border (pair with a field error message). */
  invalid?: boolean;
  className?: string;
}

/**
 * Admin image picker backed by `POST /api/admin/upload`.
 *
 * Drag & drop, click to browse or paste an image; the file is checked in the
 * browser (type, size), shown instantly as a local preview with real upload
 * progress, then replaced by the optimised Cloudinary URL via `onChange`.
 * With an image set it offers **Replace** and **Remove**. Every outcome is a
 * Sonner toast.
 *
 * Deletion is deferred: Replace/Remove only delete files uploaded in the
 * current form session (via `session`); a saved image is removed by the
 * server after the record is saved without it.
 *
 * @example
 * <ImageUpload folder="categories" value={image} onChange={setImage} session={media} />
 */
export function ImageUpload({
  value,
  onChange,
  folder,
  maxSize = MEDIA_MAX_BYTES,
  session,
  onUploaded,
  onUploadingChange,
  id,
  label = "Image",
  hint,
  aspect = "landscape",
  compact = false,
  badge,
  actions,
  placeholder,
  sizes,
  disabled = false,
  invalid = false,
  className,
}: ImageUploadProps) {
  const generatedId = useId();
  const inputId = id ?? `image-upload-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, cancel, uploading, progress, processing, preview } = useImageUploader({
    folder,
    maxSize,
    session,
    onUploadingChange,
  });

  const current = value ?? "";
  const locked = disabled || uploading;
  const limitLabel = humanFileSize(Math.min(maxSize, MEDIA_MAX_BYTES));
  const typeHint = `${MEDIA_TYPES_LABEL} · up to ${limitLabel}${hint ? ` · ${hint}` : ""}`;

  const handleFiles = useCallback(
    async (files: File[]) => {
      const [file] = files;
      if (!file) return;
      if (files.length > 1) toast.info("One image at a time", { description: `Using ${file.name}.` });

      const previous = current;
      const asset = await upload(file);
      if (!asset) return;

      onUploaded?.(asset);
      onChange(asset.url);
      // Only an unsaved upload from this session is deleted right away.
      if (previous && previous !== asset.url) session?.release(previous);
    },
    [current, upload, onUploaded, onChange, session],
  );

  const { dragging, dropProps } = useFileDrop((files) => void handleFiles(files), locked);

  const openPicker = () => {
    if (!locked) inputRef.current?.click();
  };

  const handleRemove = () => {
    if (!current || locked) return;
    const unsaved = session?.isSessionUpload(current) ?? false;
    session?.release(current);
    onChange("");
    toast.success("Image removed", {
      description: unsaved ? "The unsaved upload was deleted." : "Save to apply the change.",
    });
  };

  const fileInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={MEDIA_ACCEPT}
      tabIndex={-1}
      disabled={locked}
      className="sr-only"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        void handleFiles(files);
      }}
    />
  );

  const statusMessage = uploading ? (processing ? "Optimizing image…" : `Uploading ${progress}%`) : "";
  const previewSizes = sizes ?? (compact ? "160px" : "(min-width: 768px) 480px, 100vw");

  /* ---------- Empty: drop zone ---------- */
  if (!current && !uploading) {
    return (
      <div
        {...dropProps}
        onPaste={(event) => {
          const files = filesFromPaste(event);
          if (files.length > 0 && !locked) {
            event.preventDefault();
            void handleFiles(files);
          }
        }}
        className={className}
      >
        <button
          type="button"
          onClick={openPicker}
          disabled={locked}
          aria-label={`${label}: upload an image`}
          aria-describedby={compact ? undefined : hintId}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 border border-dashed text-center transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            compact
              ? "aspect-square rounded-lg p-2 text-[11px]"
              : cn(ASPECT_CLASSES[aspect], "min-h-40 rounded-xl px-4 py-6 text-xs"),
            dragging
              ? "border-blue-500/70 bg-blue-500/8 text-blue-200"
              : invalid
                ? "border-rose/60 bg-[#101010] text-muted-foreground hover:text-blue-300"
                : "border-[#3A3A3A] bg-[#101010] text-muted-foreground hover:border-blue-500/50 hover:text-blue-300",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid place-items-center rounded-full border border-[#2A2A2A] bg-[#151515]",
              compact ? "size-8" : "size-10",
            )}
          >
            <UploadCloud className="size-4" />
          </span>
          <span className="font-medium text-foreground">
            {dragging ? "Drop to upload" : compact ? "Add image" : "Drag & drop an image, or click to browse"}
          </span>
          {!compact && (
            <span id={hintId} className="text-[11px] text-muted-foreground">
              {typeHint}
            </span>
          )}
        </button>
        {fileInput}
      </div>
    );
  }

  /* ---------- Filled / uploading ---------- */
  return (
    <div
      {...dropProps}
      onPaste={(event) => {
        const files = filesFromPaste(event);
        if (files.length > 0 && !locked) {
          event.preventDefault();
          void handleFiles(files);
        }
      }}
      className={className}
    >
      <div
        title={current || undefined}
        className={cn(
          "relative overflow-hidden border bg-[#101010] transition-colors duration-200",
          compact ? "aspect-square rounded-lg" : cn(ASPECT_CLASSES[aspect], "rounded-xl"),
          dragging ? "border-blue-500/70" : invalid ? "border-rose/60" : "border-[#2A2A2A]",
        )}
      >
        {uploading && preview ? (
          <OptimizedImage
            src={preview}
            alt=""
            fill
            sizes={previewSizes}
            className="absolute inset-0 rounded-none"
            imageClassName="opacity-50"
          />
        ) : (
          <OptimizedImage
            src={current}
            alt={`${label} preview`}
            fill
            sizes={previewSizes}
            className="absolute inset-0 rounded-none"
            fallback={placeholder ?? <PreviewUnavailable compact={compact} />}
          />
        )}

        {badge && (
          <span className="absolute top-1.5 left-1.5 rounded-md bg-blue-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
            {badge}
          </span>
        )}

        {dragging && !uploading && (
          <div className="absolute inset-0 grid place-items-center bg-blue-500/20 text-xs font-medium text-blue-50 backdrop-blur-[1px]">
            Drop to replace
          </div>
        )}

        {uploading && (
          <UploadOverlay compact={compact} progress={progress} processing={processing} onCancel={cancel} />
        )}

        {compact && !uploading && (
          <div className="absolute right-1 bottom-1 flex gap-1">
            {actions}
            <TileButton label={`Replace ${label.toLowerCase()}`} onClick={openPicker} disabled={locked}>
              <RefreshCw aria-hidden className="size-3" />
            </TileButton>
            <TileButton label={`Remove ${label.toLowerCase()}`} onClick={handleRemove} disabled={locked} tone="danger">
              <X aria-hidden className="size-3" />
            </TileButton>
          </div>
        )}
      </div>

      {!compact && current && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={locked}
            className={cn(adminButtonGhost, "min-h-9 px-3 text-xs")}
          >
            <RefreshCw aria-hidden className="size-3.5" />
            Replace
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={locked}
            className={cn(adminButtonGhost, "min-h-9 px-3 text-xs hover:border-rose-500/40 hover:text-rose-300")}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remove
          </button>
          {actions}
          <span id={hintId} className="ml-auto text-[11px] text-muted-foreground">
            {typeHint}
          </span>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {statusMessage}
      </p>
      {fileInput}
    </div>
  );
}
