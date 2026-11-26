import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import {
  DatabaseUnavailableError,
  databaseFailureReason,
  getPrismaErrorCode,
} from "@/lib/prisma";
import {
  readThemeSettingsWithSource,
  saveThemeSettings,
} from "@/lib/data/theme-settings";
import { themeSettingsSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";
import type { ThemeSettings } from "@/lib/theme-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ThemeSaveErrorResponse {
  status: number;
  message: string;
}

const KNOWN_PRISMA_SAVE_ERRORS: Readonly<Record<string, ThemeSaveErrorResponse>> = {
  P1000: {
    status: 503,
    message:
      "Database authentication failed, so the theme was not saved. Verify the database credentials in your server configuration and retry.",
  },
  P1001: {
    status: 503,
    message:
      "The database host is unreachable, so the theme was not saved. Check the database status and connection, then retry.",
  },
  P1002: {
    status: 503,
    message:
      "Connecting to the database timed out, so the theme was not saved. Check network access and database responsiveness, then retry.",
  },
  P1003: {
    status: 503,
    message:
      "The configured database does not exist, so the theme was not saved. Verify the database name in your server configuration and retry.",
  },
  P1008: {
    status: 503,
    message:
      "The database operation timed out before the theme could be saved. Check database load and retry.",
  },
  P1017: {
    status: 503,
    message:
      "The database connection was closed before the theme could be saved. Check database availability and connection limits, then retry.",
  },
  P2002: {
    status: 409,
    message:
      "A conflicting theme settings update occurred at the same time. Please retry applying your theme.",
  },
  P2021: {
    status: 503,
    message:
      "The ThemeSettings table is missing in the database, so the theme was not saved. Apply the database schema migration for theme settings and retry.",
  },
  P2022: {
    status: 503,
    message:
      "The ThemeSettings database schema is out of date (missing column), so the theme was not saved. Apply the latest database schema migration and retry.",
  },
  P2024: {
    status: 503,
    message:
      "The database connection pool timed out before the theme could be saved. Wait a moment or check active database connections, then retry.",
  },
};

function isDatabaseUnavailable(error: unknown): boolean {
  return (
    error instanceof DatabaseUnavailableError ||
    (error instanceof Error && error.name === "DatabaseUnavailableError")
  );
}

function classifyThemeSaveError(error: unknown): ThemeSaveErrorResponse {
  const code = getPrismaErrorCode(error);
  if (code && Object.hasOwn(KNOWN_PRISMA_SAVE_ERRORS, code)) {
    return KNOWN_PRISMA_SAVE_ERRORS[code]!;
  }
  if (isDatabaseUnavailable(error)) {
    return {
      status: 503,
      message:
        "The database is unavailable or not configured, so the theme was not saved. Confirm the database is configured, running, and reachable, then retry.",
    };
  }
  return {
    status: 500,
    message:
      "Could not save theme settings due to an unexpected error. Please try again later.",
  };
}

function safeErrorLogSummary(error: unknown): string {
  return (
    databaseFailureReason(error) ??
    getPrismaErrorCode(error) ??
    (isDatabaseUnavailable(error)
      ? "DatabaseUnavailableError"
      : error instanceof Error && error.name
        ? error.name
        : "unknown error")
  );
}

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

  const { settings, source } = await readThemeSettingsWithSource();
  return NextResponse.json({
    data: settings,
    error: null,
    success: true,
    // Map the data-layer's "defaults" to the API contract's "mock" so the UI
    // can distinguish fail-safe defaults from real persisted values.
    source: source === "database" ? "database" : "mock",
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
    console.error(
      `[admin/settings/theme] Failed to save theme settings (${safeErrorLogSummary(error)})`,
    );
    const { status, message } = classifyThemeSaveError(error);
    return NextResponse.json(
      {
        data: null,
        error: message,
        success: false,
      },
      { status },
    );
  }
}
