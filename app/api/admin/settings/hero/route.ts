import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { getHeroSettings, saveHeroSettings } from "@/lib/data/hero-settings";
import { settingsHeroSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";
import type { HeroSettings } from "@/lib/hero-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hero/banner settings are the SEO manager's surface (plus super admins), so
 * both reading the current values and saving them need `settings:write`.
 */
async function isAdministrator(): Promise<boolean> {
  const gate = await requireActionRole(rolesForPermission("settings:write"));
  return gate.ok;
}

export async function GET(): Promise<NextResponse<ApiResponse<HeroSettings>>> {
  if (!(await isAdministrator())) {
    return NextResponse.json(
      { data: null, error: "Administrator access required", success: false },
      { status: 403 },
    );
  }

  const settings = await getHeroSettings();
  return NextResponse.json({
    data: settings,
    error: null,
    success: true,
  });
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<HeroSettings>>> {
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
      { data: null, error: "Expected a JSON hero settings payload", success: false },
      { status: 400 },
    );
  }

  const parsed = settingsHeroSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: parsed.error.issues[0]?.message ?? "Invalid hero settings",
        success: false,
      },
      { status: 400 },
    );
  }

  try {
    const settings = await saveHeroSettings(parsed.data);
    revalidatePath("/");
    return NextResponse.json({
      data: settings,
      error: null,
      success: true,
      source: "database",
    });
  } catch (error) {
    console.error("[admin/settings/hero] Failed to save hero settings", error);
    return NextResponse.json(
      {
        data: null,
        error: "Could not save hero settings. Confirm the database is configured and schema is up to date.",
        success: false,
      },
      { status: 503 },
    );
  }
}
