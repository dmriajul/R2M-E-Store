import { getActiveThemeCssVars } from "@/lib/data/theme-settings";

/**
 * Injects the active theme's CSS custom properties into the storefront.
 *
 * Rendered inside the `(shop)` and `(auth)` route-group layouts — the
 * customer-facing groups — so the theme applies across the homepage, nav,
 * footer, shop, product, cart, checkout, dashboard and auth pages. The Admin
 * Console lives outside these groups and keeps its own consistent chrome.
 *
 * `display: contents` makes the wrapper generate no box: its children participate
 * directly in the parent's layout (preserving flex/grid structure exactly),
 * while the CSS variables still cascade to every descendant — including
 * fixed/sticky navbar and footer. Because this is a server component, the
 * variables are in the initial HTML, so there is no flash of the wrong theme.
 */
export async function ThemeStyles({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cssVars = await getActiveThemeCssVars();

  return (
    <div style={{ ...cssVars, display: "contents" }}>{children}</div>
  );
}
