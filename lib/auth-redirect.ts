const DISALLOWED_AUTH_CALLBACK_PATH =
  /^\/(?:login|register|signup|forgot-password|reset-password|auth|api\/auth)(?:\/|$)/i;

/** Only same-origin application paths may be used after authentication. */
export function safeCallbackPath(value: string | null, origin: string): string {
  if (typeof value !== "string") return "/dashboard";
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F\\]/.test(trimmed)) return "/dashboard";

  const isRelativePath = trimmed.startsWith("/") && !trimmed.startsWith("//");
  let target: URL;
  try {
    const baseOrigin = new URL(origin).origin;
    if (!isRelativePath && !/^https?:\/\//i.test(trimmed)) {
      return "/dashboard";
    }
    target = new URL(trimmed, baseOrigin);
    if (target.origin !== baseOrigin || !["http:", "https:"].includes(target.protocol)) {
      return "/dashboard";
    }
  } catch {
    return "/dashboard";
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(target.pathname);
  } catch {
    return "/dashboard";
  }

  if (
    !target.pathname.startsWith("/") ||
    target.pathname.startsWith("//") ||
    !decodedPathname.startsWith("/") ||
    decodedPathname.startsWith("//") ||
    /[\u0000-\u001F\u007F\\]/.test(decodedPathname)
  ) {
    return "/dashboard";
  }
  if (
    DISALLOWED_AUTH_CALLBACK_PATH.test(target.pathname) ||
    DISALLOWED_AUTH_CALLBACK_PATH.test(decodedPathname)
  ) {
    return "/dashboard";
  }
  return `${target.pathname}${target.search}${target.hash}`;
}
