"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Star, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  ImageUpload,
  TileButton,
  UploadOverlay,
  filesFromPaste,
  useFileDrop,
  useImageUploader,
} from "@/components/admin/ImageUpload";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import type { MediaSession } from "@/hooks/useMediaSession";
import { humanFileSize } from "@/lib/images";
import {
  MEDIA_ACCEPT,
  MEDIA_FOLDERS,
  MEDIA_MAX_BYTES,
  MEDIA_TYPES_LABEL,
  PRODUCT_GALLERY_LIMIT,
  type MediaFolder,
} from "@/lib/media";
import { cn } from "@/lib/utils";

export interface ImageGalleryUploadProps {
  /** Image URLs in display order — the first one is the cover. */
  value: readonly string[];
  onChange: (urls: string[]) => void;
  /** Destination folder for new uploads (`products` for the catalogue). */
  folder: MediaFolder;
  /** Gallery size limit (default 5). */
  max?: number;
  /** Max bytes per file (default and ceiling: 5 MB). */
  maxSize?: number;
  session?: MediaSession;
  /** `true` while any tile (or a batch) is uploading. */
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  /** Id of the "add" tile's file input. */
  id?: string;
  /** Accessible name for the gallery, e.g. "Product images". */
  label?: string;
  /** Tile content for entries that aren't loadable images (legacy tokens). */
  placeholder?: React.ReactNode;
  className?: string;
}

/**
 * Multi-image uploader for product galleries.
 *
 * Each image is an `ImageUpload` tile (Replace / Remove, plus "Make cover" on
 * every tile but the first); the trailing tile accepts several files at once —
 * drop, browse or paste — and uploads them one after another. All updates go
 * through the latest array, so tiles can be reordered or replaced while a
 * batch is still uploading.
 */
export function ImageGalleryUpload({
  value,
  onChange,
  folder,
  max = PRODUCT_GALLERY_LIMIT,
  maxSize = MEDIA_MAX_BYTES,
  session,
  onUploadingChange,
  disabled = false,
  id,
  label = "Images",
  placeholder,
  className,
}: ImageGalleryUploadProps) {
  // The array as of the last change — sequential uploads append to this, not
  // to a stale render's `value`.
  const latest = useRef<readonly string[]>(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const busyCount = useRef(0);
  const [busy, setBusy] = useState(false);
  const busyCallback = useRef(onUploadingChange);
  useEffect(() => {
    busyCallback.current = onUploadingChange;
  }, [onUploadingChange]);

  const trackBusy = useCallback((uploading: boolean) => {
    busyCount.current = Math.max(0, busyCount.current + (uploading ? 1 : -1));
    const next = busyCount.current > 0;
    setBusy(next);
    busyCallback.current?.(next);
  }, []);

  const commit = useCallback(
    (next: string[]) => {
      latest.current = next;
      onChange(next);
    },
    [onChange],
  );
  const append = useCallback((url: string) => commit([...latest.current, url]), [commit]);
  const replace = useCallback(
    (from: string, to: string) => commit(latest.current.map((url) => (url === from ? to : url))),
    [commit],
  );
  const remove = useCallback(
    (target: string) => commit(latest.current.filter((url) => url !== target)),
    [commit],
  );
  const makeCover = useCallback(
    (target: string) => commit([target, ...latest.current.filter((url) => url !== target)]),
    [commit],
  );

  // Stable keys survive reordering; duplicates (legacy data) get a suffix.
  const keys = useMemo(() => {
    const seen = new Map<string, number>();
    return value.map((url) => {
      const count = seen.get(url) ?? 0;
      seen.set(url, count + 1);
      return count === 0 ? url : `${url}#${count}`;
    });
  }, [value]);

  const remaining = Math.max(0, max - value.length);

  return (
    <div className={className}>
      <ul aria-label={label} className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {value.map((url, index) => (
          <li key={keys[index]}>
            <ImageUpload
              compact
              value={url}
              onChange={(next) => (next ? replace(url, next) : remove(url))}
              folder={folder}
              maxSize={maxSize}
              session={session}
              onUploadingChange={trackBusy}
              disabled={disabled}
              label={`Image ${index + 1}`}
              badge={index === 0 ? "Cover" : undefined}
              placeholder={placeholder}
              sizes="160px"
              actions={
                index > 0 ? (
                  <TileButton label={`Make image ${index + 1} the cover`} onClick={() => makeCover(url)} disabled={disabled}>
                    <Star aria-hidden className="size-3" />
                  </TileButton>
                ) : undefined
              }
            />
          </li>
        ))}

        {(remaining > 0 || busy) && (
          <li>
            <GalleryAddTile
              id={id}
              folder={folder}
              maxSize={maxSize}
              session={session}
              max={max}
              remaining={remaining}
              disabled={disabled}
              onAdd={append}
              onUploadingChange={trackBusy}
            />
          </li>
        )}
      </ul>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {value.length}/{max} images · the first image is the cover · {MEDIA_TYPES_LABEL}, up to{" "}
        {humanFileSize(Math.min(maxSize, MEDIA_MAX_BYTES))} each · stored in {MEDIA_FOLDERS[folder]}/
      </p>
    </div>
  );
}

/** The trailing "add" tile: several files per drop, uploaded in sequence. */
function GalleryAddTile({
  id,
  folder,
  maxSize,
  session,
  max,
  remaining,
  disabled,
  onAdd,
  onUploadingChange,
}: {
  id?: string;
  folder: MediaFolder;
  maxSize: number;
  session?: MediaSession;
  max: number;
  remaining: number;
  disabled: boolean;
  onAdd: (url: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const stopped = useRef(false);
  const [batch, setBatch] = useState<{ index: number; total: number } | null>(null);
  // Busy is reported for the whole batch, not per file, so the tile (and the
  // form's Save button) stay locked between files.
  const { upload, cancel, progress, processing, preview } = useImageUploader({ folder, maxSize, session });
  const active = batch !== null;

  const handleFiles = async (files: File[]) => {
    if (files.length === 0 || active || disabled) return;
    if (remaining <= 0) {
      toast.warning("The gallery is full", { description: `Remove an image first — up to ${max} per product.` });
      return;
    }

    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`Only ${remaining} more image${remaining === 1 ? "" : "s"} fit`, {
        description: `A gallery holds up to ${max} images, so ${files.length - remaining} ${files.length - remaining === 1 ? "was" : "were"} skipped.`,
      });
    }

    stopped.current = false;
    onUploadingChange(true);
    let uploaded = 0;
    try {
      for (const [index, file] of accepted.entries()) {
        if (stopped.current) break;
        setBatch({ index, total: accepted.length });
        const asset = await upload(file, { quiet: accepted.length > 1 });
        if (asset) {
          onAdd(asset.url);
          uploaded += 1;
        }
      }
    } finally {
      setBatch(null);
      onUploadingChange(false);
    }

    if (accepted.length > 1 && uploaded > 0) {
      toast.success(
        uploaded === accepted.length
          ? `${uploaded} images uploaded`
          : `${uploaded} of ${accepted.length} images uploaded`,
        { description: `Saved to ${MEDIA_FOLDERS[folder]}` },
      );
    }
  };

  const stop = () => {
    stopped.current = true;
    cancel();
  };

  const { dragging, dropProps } = useFileDrop((files) => void handleFiles(files), disabled || active);

  return (
    <div
      {...dropProps}
      onPaste={(event) => {
        const files = filesFromPaste(event);
        if (files.length > 0) {
          event.preventDefault();
          void handleFiles(files);
        }
      }}
      className="relative aspect-square"
    >
      {batch ? (
        <div className="relative h-full overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#101010]">
          {preview && (
            <OptimizedImage
              src={preview}
              alt=""
              fill
              sizes="160px"
              className="absolute inset-0 rounded-none"
              imageClassName="opacity-50"
            />
          )}
          <UploadOverlay
            compact
            progress={progress}
            processing={processing}
            onCancel={stop}
            caption={batch.total > 1 ? `${batch.index + 1}/${batch.total}` : undefined}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || remaining === 0}
          aria-label={`Add images (${remaining} of ${max} left)`}
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-4 text-center text-[11px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            dragging
              ? "border-blue-500/70 bg-blue-500/8 text-blue-200"
              : "border-[#3A3A3A] bg-[#101010] text-muted-foreground hover:border-blue-500/50 hover:text-blue-300",
          )}
        >
          <UploadCloud aria-hidden className="size-4" />
          <span className="font-medium">{dragging ? "Drop to add" : "Add images"}</span>
          <span className="text-[10px] text-muted-foreground">{remaining} left</span>
        </button>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void handleFiles(files);
        }}
      />
    </div>
  );
}
