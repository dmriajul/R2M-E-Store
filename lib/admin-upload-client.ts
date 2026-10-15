/**
 * Browser client for `/api/admin/upload`.
 *
 * Uploads use `XMLHttpRequest` rather than `fetch` because only XHR reports
 * upload progress. Every failure becomes an `UploadError` whose message can go
 * straight into a toast — including the plain-text 413 a hosting platform
 * answers before the route ever runs (Vercel caps request bodies at 4.5 MB).
 */

import type { MediaFolder } from "@/lib/media";
import type { AdminUploadErrorBody, AdminUploadResult } from "@/types";

export const ADMIN_UPLOAD_ENDPOINT = "/api/admin/upload";

/** A failed upload; `status` is the HTTP status (0 for network errors). */
export class UploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

/** True when the upload was cancelled through its `AbortSignal`. */
export function isUploadAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export interface UploadProgress {
  /** 0–100 across the byte transfer. */
  percent: number;
  /** Every byte is sent — the server is now storing and optimising the image. */
  processing: boolean;
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

/** Copy for responses that carry no JSON error (proxies, platform limits). */
function fallbackMessage(status: number): string {
  switch (status) {
    case 0:
      return "Network error — check your connection and try again.";
    case 401:
      return "Your session has expired — sign in again to upload.";
    case 403:
      return "Your role can't upload images here.";
    case 413:
      return "That file is too large for the server. Images must be 5 MB or smaller (Vercel deployments cap uploads at 4.5 MB).";
    case 415:
      return "That file type isn't supported. Upload a JPG, PNG, WebP or AVIF image.";
    case 429:
      return "Too many uploads — wait a minute and try again.";
    case 504:
      return "The upload timed out — try again.";
    default:
      return status >= 500
        ? "The upload service is unavailable — try again shortly."
        : `The upload failed (HTTP ${status}).`;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isUploadResult(value: unknown): value is AdminUploadResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.url === "string" && typeof record.publicId === "string";
}

function errorFromBody(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as Partial<AdminUploadErrorBody>).error;
  return typeof message === "string" && message.trim() ? message : null;
}

/**
 * Uploads one image to `folder` and resolves with the stored asset.
 *
 * @throws {UploadError} with a user-facing message on any failure.
 * @throws {DOMException} `AbortError` when `signal` aborts (see `isUploadAbort`).
 */
export function uploadAdminImage(
  file: File,
  folder: MediaFolder,
  { signal, onProgress }: UploadOptions = {},
): Promise<AdminUploadResult> {
  return new Promise<AdminUploadResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }

    // Folder first, so the server can route the file before reading it.
    const body = new FormData();
    body.append("folder", folder);
    body.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${ADMIN_UPLOAD_ENDPOINT}?folder=${encodeURIComponent(folder)}`);
    xhr.responseType = "text";
    xhr.timeout = 120_000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress?.({
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
        processing: event.loaded >= event.total,
      });
    };
    xhr.upload.onload = () => onProgress?.({ percent: 100, processing: true });

    xhr.onload = () => {
      const payload = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && isUploadResult(payload)) {
        resolve(payload);
        return;
      }
      reject(new UploadError(errorFromBody(payload) ?? fallbackMessage(xhr.status), xhr.status));
    };
    xhr.onerror = () => reject(new UploadError(fallbackMessage(0), 0));
    xhr.ontimeout = () => reject(new UploadError(fallbackMessage(504), 504));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/**
 * Best-effort delete of an image this form session uploaded (replaced,
 * removed, or abandoned on cancel). Never throws — a leftover file is
 * harmless, and the server refuses to delete anything a saved record uses.
 *
 * `keepalive` lets the request finish even if the page navigates away.
 */
export async function deleteAdminImage(target: { publicId: string; url?: string }): Promise<boolean> {
  const params = new URLSearchParams({ publicId: target.publicId });
  if (target.url) params.set("url", target.url);

  try {
    const response = await fetch(`${ADMIN_UPLOAD_ENDPOINT}?${params.toString()}`, {
      method: "DELETE",
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
