import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { readThemeSettings, saveThemeSettings } from "@/lib/data/theme-settings";
import { themeSettingsSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";
import type { ThemeSettings } from "@/lib/theme-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Theme settings are the SEO manager's surface (plus super admins), so both
 * reading the current values and saving them need `settings:write` — the same
 * permission the hero/banner editor uses.
 */
async function isAdministrator(): Promise<boolean> {
  const gate = await requireActionRole(rolesForPermission("settings:write"));
  return gate.ok;
}

export async function GET(): Promise<NextResponse<ApiResponse<ThemeSettings>>> {
  if (!(await isAdministrator())) {
    return NextResponse.json(
      { data: null, error: "Administrator access required", success: false },
      { status: 403 },
    );
  }

  const settings = await readThemeSettings();
  return NextResponse.json({
    data: settings,
    error: null,
    success: true,
  });
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ThemeSettings>>> {
  if (!(await isAdministrator())) {
    return NextResponse.json(
      { data: null, error: "Administrator access required", success: false },
      { status: 403 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Expected a JSON theme settings payload", success: false },
      { status: 400 },
    );
  }

  const parsed = themeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: parsed.error.issues[0]?.message ?? "Invalid theme settings",
        success: false,
      },
      { status: 400 },
    );
  }

  try {
    const settings = await saveThemeSettings(parsed.data);
    // Invalidate the storefront theme cache and re-render the live pages.
    // Safe to skip outside a request scope (e.g. in unit tests) — the write
    // above already succeeded and the data-layer cache tag was invalidated.
    try {
      revalidatePath("/", "layout");
    } catch {
      // No-op outside a Next request context.
    }
    return NextResponse.json({
      data: settings,
      error: null,
      success: true,
      source: "database",
    });
  } catch (error) {
    console.error("[admin/settings/theme] Failed to save theme settings", error);
    return NextResponse.json(
      {
        data: null,
        error: "Could not save theme settings. Confirm the database is configured and schema is up to date.",
        success: false,
      },
      { status: 503 },
    );
  }
}
