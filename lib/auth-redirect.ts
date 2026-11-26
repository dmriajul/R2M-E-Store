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

  if (!target.pathname.startsWith("/") || target.pathname.startsWith("//")) {
    return "/dashboard";
  }
  if (/^\/(login|register|signup|api\/auth)(\/|$)/.test(target.pathname)) {
    return "/dashboard";
  }
  return `${target.pathname}${target.search}${target.hash}`;
}
