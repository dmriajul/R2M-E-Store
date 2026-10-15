"use client";

import { useEffect, useMemo, useRef } from "react";
import { deleteAdminImage } from "@/lib/admin-upload-client";

/**
 * Tracks the images uploaded while a console form is open, so uploads that are
 * never saved don't pile up in Cloudinary.
 *
 * The rule is simple: **only this session's own uploads are ever deleted from
 * the browser.** An image that is already saved on a record is left alone when
 * the operator removes or replaces it — if they cancel, nothing was lost; if
 * they save, the server deletes it afterwards (`scheduleImageCleanup`), and
 * only when no other record still uses it.
 */
export interface MediaSession {
  /** Record a successful upload. */
  track(asset: { url: string; publicId: string }): void;
  /**
   * An image left the form (Remove, or replaced by a new upload). Deleted now
   * if this session uploaded it; persisted images are left for the server.
   */
  release(url: string | null | undefined): void;
  /**
   * The form saved. Session uploads that are not in `keptUrls` are deleted;
   * the rest now belong to the saved record.
   */
  commit(keptUrls?: Iterable<string | null | undefined>): void;
  /** The form closed without saving: delete every upload from this session. */
  discard(): void;
  /** Was `url` uploaded in this session (and not yet committed)? */
  isSessionUpload(url: string | null | undefined): boolean;
}

/**
 * One session per form instance. Call `commit()` after a successful save and
 * `discard()` when the form closes without saving; unmounting discards too.
 *
 * @example
 * const media = useMediaSession();
 * <ImageUpload value={image} onChange={setImage} folder="categories" session={media} />
 * // on save:   media.commit([values.image]);
 * // on cancel: media.discard();
 */
export function useMediaSession(): MediaSession {
  /** url → publicId for uploads that haven't been committed yet. */
  const uploads = useRef(new Map<string, string>());

  const session = useMemo<MediaSession>(() => {
    const remove = (url: string) => {
      const publicId = uploads.current.get(url);
      if (!publicId) return;
      uploads.current.delete(url);
      void deleteAdminImage({ publicId, url });
    };

    return {
      track(asset) {
        uploads.current.set(asset.url, asset.publicId);
      },
      release(url) {
        if (url) remove(url);
      },
      commit(keptUrls = []) {
        const kept = new Set<string>();
        for (const url of keptUrls) if (url) kept.add(url);
        for (const url of [...uploads.current.keys()]) {
          if (!kept.has(url)) remove(url);
        }
        uploads.current.clear();
      },
      discard() {
        for (const url of [...uploads.current.keys()]) remove(url);
      },
      isSessionUpload(url) {
        return Boolean(url && uploads.current.has(url));
      },
    };
  }, []);

  // Leaving the page with the form open counts as cancelling it.
  useEffect(() => () => session.discard(), [session]);

  return session;
}
