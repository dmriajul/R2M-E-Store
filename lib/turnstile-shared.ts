/** Safe to import in the browser. Secret/configuration access stays in lib/turnstile.ts. */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFR9W3cd66AOTr2B";
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
export const TURNSTILE_ERROR = "Security verification failed. Please try again.";
export type TurnstileAction = "login" | "register" | "review" | "resend_verification";

const INVISIBLE_OR_CONTROL_CHARS = /[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g;
const VALID_KEY_BOUNDARY = /^[A-Za-z0-9._:-]+$/;
/** Cloudflare Turnstile secret keys are 35 chars (`[0-3]x` + 33 base64url chars). */
const CLOUDFLARE_SECRET_KEY_SHAPE = /^[0-3]x[A-Za-z0-9_-]{33}$/;

let secretInPublicKeyWarned = false;

/**
 * Strip surrounding whitespace, BOM/zero-width/control characters, accidental
 * `KEY=` prefixes, inline `#` `.env` comments, and outer escaped or literal
 * quotes (`"..."`, `'...'`, `` `...` ``, smart quotes) from an env value.
 */
export function sanitizeTurnstileEnvValue(
  raw: string | undefined | null,
  expectedVarName?: string,
): string {
  if (typeof raw !== "string") return "";
  let value = raw.replace(INVISIBLE_OR_CONTROL_CHARS, "").trim();
  if (!value) return "";

  if (expectedVarName) {
    const prefixPattern = new RegExp(`^${expectedVarName}\\s*=\\s*`, "i");
    value = value.replace(prefixPattern, "").trim();
  }

  // Strip unquoted inline .env comments (e.g. `0x4... # production key`).
  value = value.replace(/\s+#.*$/, "").trim();

  // Repeatedly peel escaped quotes (`\"`) and outer quote wrappers (`"`, `'`, `` ` ``, smart quotes).
  let previous = "";
  while (value && value !== previous) {
    previous = value;
    value = value
      .replace(/^\\+["'`“”‘’]+/, "")
      .replace(/\\+["'`“”‘’]+$/, "")
      .replace(/^["'`“”‘’]+/, "")
      .replace(/["'`“”‘’]+$/, "")
      .trim();
  }

  return value;
}

/**
 * True when a sanitized Turnstile key has valid character boundaries (no inner
 * whitespace, quotes, slashes, semicolons, or control artifacts).
 */
export function isTurnstileKeyBoundaryValid(value: string): boolean {
  return value.length > 0 && value.length <= 256 && VALID_KEY_BOUNDARY.test(value);
}

/**
 * Resolve the public Turnstile site key.
 *
 * Uses `NEXT_PUBLIC_TURNSTILE_SITE_KEY` when non-empty and valid, falling back
 * to the store's configured Cloudflare widget key (`0x4AAAAAAFR9W3cd66AOTr2B`)
 * if unset, blank, malformed, or accidentally populated with a 35-character
 * Turnstile secret key. Passing an explicit `siteKey` string (including `""` in
 * unit tests) overrides environment lookup.
 */
export function getTurnstileSiteKey(explicitSiteKey?: string): string {
  if (explicitSiteKey !== undefined) {
    const cleanedExplicit = sanitizeTurnstileEnvValue(explicitSiteKey);
    return isTurnstileKeyBoundaryValid(cleanedExplicit) ? cleanedExplicit : "";
  }

  const configured = sanitizeTurnstileEnvValue(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  );
  if (!configured || !isTurnstileKeyBoundaryValid(configured)) {
    return TURNSTILE_SITE_KEY;
  }

  if (CLOUDFLARE_SECRET_KEY_SHAPE.test(configured)) {
    if (typeof window === "undefined" && !secretInPublicKeyWarned) {
      secretInPublicKeyWarned = true;
      console.warn(
        "[turnstile] Configured public key has length 35 (matches a Turnstile secret key rather than a 24-character site key). " +
          "Falling back to the configured 24-character public site key; rotate the exposed secret key in Cloudflare Dashboard.",
      );
    }
    return TURNSTILE_SITE_KEY;
  }

  return configured;
}

/**
 * Read and clear `cf-turnstile-response` from a `<form>` element.
 *
 * Queries all matching `<input>` elements directly rather than relying solely
 * on `form.elements.namedItem(...)`, which returns a `RadioNodeList` whose
 * `.value` is `""` for `<input type="hidden">` whenever more than one matching
 * hidden input exists in the DOM.
 */
export function consumeFormTurnstileToken(
  form: HTMLFormElement | null | undefined,
): string {
  if (!form) return "";
  let found = "";

  if (typeof form.querySelectorAll === "function") {
    const inputs = form.querySelectorAll<HTMLInputElement>(
      `input[name="${TURNSTILE_RESPONSE_FIELD}"]`,
    );
    for (const input of inputs) {
      const candidate = typeof input.value === "string" ? input.value.trim() : "";
      if (!found && candidate && candidate !== "undefined" && candidate !== "null") {
        found = candidate;
      }
      input.value = "";
    }
    if (found) return found;
  }

  const named = form.elements?.namedItem?.(TURNSTILE_RESPONSE_FIELD);
  if (named && "value" in named && typeof named.value === "string") {
    const candidate = named.value.trim();
    named.value = "";
    if (candidate && candidate !== "undefined" && candidate !== "null") {
      return candidate;
    }
  }

  return "";
}

/**
 * Explicit opt-in development-only CAPTCHA bypass (`next dev` ONLY).
 *
 * Never active when `NODE_ENV === "production"` or `"test"`, even if the env
 * variable is accidentally present.
 */
export function isTurnstileBypassed(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (sanitizeTurnstileEnvValue(process.env.NEXT_PUBLIC_TURNSTILE_DEV_BYPASS) === "true" ||
      sanitizeTurnstileEnvValue(process.env.TURNSTILE_DEV_BYPASS) === "true")
  );
}
