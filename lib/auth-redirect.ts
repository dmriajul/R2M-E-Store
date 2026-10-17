/** Only same-origin application paths may be used after authentication. */
export function safeCallbackPath(value: string | null, origin: string): string {
  if (!value) return "/dashboard";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || !["http:", "https:"].includes(target.protocol))
      return "/dashboard";
    if (/^\/(login|register|api\/auth)(\/|$)/.test(target.pathname)) return "/dashboard";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/dashboard";
  }
}
