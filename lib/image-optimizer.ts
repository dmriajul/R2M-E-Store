/**
 * Image URL helpers — Cloudinary transformations when the asset lives on
 * Cloudinary, untouched URLs for everything else (Unsplash leftovers, files in
 * `/uploads/…`, gradient placeholder tokens).
 *
 * Every function here is pure string maths: no network calls, no SDK, safe to
 * import from server components, client components and route handlers alike.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Named size buckets used across the storefront. */
export type ImagePreset = "thumbnail" | "card" | "detail" | "zoom" | "blur" | "og";

interface PresetSpec {
  /** Default width in px (also the fallback when a preset has no width list). */
  width: number;
  /** Height ÷ width — Cloudinary crops to this ratio so cards never reflow. */
  aspect: number;
  /** Breakpoints used to build `srcSet` strings. */
  srcWidths: readonly number[];
  /** Appended to the transformation chain (quality/e_blur/dpr hints). */
  extra?: string;
}

export const IMAGE_PRESETS: Readonly<Record<ImagePreset, PresetSpec>> = {
  thumbnail: { width: 96, aspect: 1, srcWidths: [64, 96, 160] },
  card: { width: 400, aspect: 1.25, srcWidths: [240, 400, 640] },
  detail: { width: 800, aspect: 1.25, srcWidths: [480, 800, 1200] },
  zoom: { width: 1600, aspect: 1.25, srcWidths: [1200, 1600, 2000], extra: "dpr_auto" },
  blur: { width: 24, aspect: 1, srcWidths: [16, 24, 40], extra: "e_blur:400" },
  og: { width: 1200, aspect: 0.525, srcWidths: [600, 1200] },
};

/** Every preset name, in display order — handy for loaders and docs. */
export const IMAGE_PRESETS_KEYS = [
  "thumbnail",
  "card",
  "detail",
  "zoom",
  "blur",
  "og",
] as const satisfies readonly ImagePreset[];

/** Hosts we know how to rewrite in the URL itself. */
const UPLOAD_MARKER = "/image/upload/";

/* -------------------------------------------------------------------------- */
/*  Detection                                                                  */
/* -------------------------------------------------------------------------- */

/** True when the URL points at a Cloudinary delivery endpoint. */
export function isCloudinaryUrl(url: string): boolean {
  return Boolean(url) && url.includes("res.cloudinary.com") && url.includes(UPLOAD_MARKER);
}

/**
 * Seeded products sometimes already carry a transformation segment
 * (`/upload/f_auto,q_auto/v123/…`) or a version. We drop everything between
 * `upload/` and the version so presets never stack on top of each other.
 */
function stripTransformation(url: string): string {
  const markerIndex = url.indexOf(UPLOAD_MARKER);
  if (markerIndex === -1) return url;

  const head = url.slice(0, markerIndex + UPLOAD_MARKER.length);
  const tail = url.slice(markerIndex + UPLOAD_MARKER.length);
  const segments = tail.split("/");
  const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));

  if (versionIndex <= 0) return url;
  return `${head}${segments.slice(versionIndex).join("/")}`;
}

/* -------------------------------------------------------------------------- */
/*  URL building                                                               */
/* -------------------------------------------------------------------------- */

/** Transformation chain for a preset at a concrete pixel width. */
function transformationFor(preset: ImagePreset, width: number): string {
  const spec = IMAGE_PRESETS[preset];
  const height = Math.max(1, Math.round(width * spec.aspect));
  const quality = preset === "blur" ? "f_auto,q_auto:low" : "f_auto,q_auto";
  const base = `c_fill,g_auto,w_${width},h_${height},${quality}`;
  return spec.extra && preset !== "blur" ? `${base},${spec.extra}` : base;
}

/**
 * Rewrites a Cloudinary URL for `preset` at an optional `width`.
 * Non-Cloudinary URLs come back untouched.
 */
export function cloudinaryUrl(url: string, preset: ImagePreset = "card", width?: number): string {
  if (!isCloudinaryUrl(url)) return url;

  const clean = stripTransformation(url);
  const markerIndex = clean.indexOf(UPLOAD_MARKER);
  const head = clean.slice(0, markerIndex + UPLOAD_MARKER.length);
  const tail = clean.slice(markerIndex + UPLOAD_MARKER.length);

  const resolved = width ?? IMAGE_PRESETS[preset].width;
  return `${head}${transformationFor(preset, resolved)}/${tail}`;
}

/**
 * Returns a delivery URL for `url` sized for `preset`.
 *
 * - Cloudinary assets get `f_auto,q_auto` plus the preset's crop/size chain.
 * - Everything else (Unsplash, `/uploads/…`, gradients, data URLs, empty
 *   strings) is returned exactly as-is.
 */
export function getOptimizedUrl(url: string, preset: ImagePreset = "card"): string {
  return cloudinaryUrl(url, preset);
}

/**
 * Builds a responsive `srcSet` string.
 *
 * Pass explicit `widths` to override the preset breakpoints. Non-Cloudinary URLs
 * return `undefined`, so callers can skip the attribute entirely and let
 * `next/image` (or a plain `<img>`) handle sizing on its own.
 *
 * @example
 * getResponsiveSrcSet("https://res.cloudinary.com/demo/image/upload/v1/tee.jpg", "card");
 * // → "…/w_240,h_300/…/tee.jpg 240w, …/w_400,h_500/…/tee.jpg 400w, …/w_640,h_800/…/tee.jpg 640w"
 */
export function getResponsiveSrcSet(
  url: string,
  preset: ImagePreset = "card",
  widths?: readonly number[],
): string | undefined {
  if (!isCloudinaryUrl(url)) return undefined;

  const resolved = widths?.length ? widths : IMAGE_PRESETS[preset].srcWidths;
  return resolved.map((width) => `${cloudinaryUrl(url, preset, width)} ${width}w`).join(", ");
}

/**
 * A tiny inline blur placeholder: a blurred 24px copy of the same asset.
 * Returns `undefined` for non-Cloudinary sources (we show a shimmer instead).
 */
export function getBlurDataUrl(url: string): string | undefined {
  if (!isCloudinaryUrl(url)) return undefined;
  return cloudinaryUrl(url, "blur");
}

/** Default `sizes` attribute per preset — stops `next/image` over-fetching. */
export const PRESET_SIZES: Readonly<Record<ImagePreset, string>> = {
  thumbnail: "96px",
  card: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px",
  detail: "(max-width: 1024px) 100vw, 640px",
  zoom: "100vw",
  blur: "24px",
  og: "1200px",
};
