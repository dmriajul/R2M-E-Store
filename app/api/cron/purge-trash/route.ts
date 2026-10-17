import { NextResponse } from "next/server";
import { purgeExpiredAdminUsers } from "@/lib/data/admin-users";
import { TRASH_RETENTION_DAYS } from "@/lib/rbac";

/**
 * **Trash retention sweeper** — the scheduled half of *Staff & Roles → Trash*.
 *
 * `trashUsersAction` only ever stamps `User.deletedAt`, so nothing is lost by
 * accident: the account can no longer sign in, and the console shows a countdown
 * for `TRASH_RETENTION_DAYS`. This route is what finally makes the deletion
 * real, on the schedule in `vercel.json`:
 *
 *     GET /api/cron/purge-trash        (Vercel Cron, daily at 03:00)
 *
 * **Double-owner guard.** Deleting the last *live* super admin would lock the
 * console, so the policy in `lib/rbac.ts` protects it interactively. A scheduled
 * job has no session and therefore no actor — instead the sweeper deletes only
 * rows that an operator already moved to the trash (`deletedAt` in the past, and
 * past the retention window), which is exactly the set the guard rails already
 * vetted when they were trashed.
 *
 * **Orders keep their customer.** An account that still holds an order or a
 * review is never deleted (a foreign key would break or erase real store
 * history); `purgeExpiredAdminUsers()` reports those as `skipped` and leaves them
 * in the trash for a human to restore or resolve.
 *
 * **Authentication.** `CRON_SECRET` is compared against the `Authorization:
 * Bearer …` header Vercel Cron sends. Without the secret configured the route
 * refuses to run in production (an unauthenticated deletion endpoint would be a
 * gift to anyone who guessed the path) and answers `401`.
 *
 * Outside production this route is also safe to call by hand. Without a
 * `DATABASE_URL` the route reports the failure (503) — there is no demo trash
 * and nothing is swept lazily.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Constant-time-ish comparison; both values are short, fixed-format strings. */
function secretMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let index = 0; index < provided.length; index += 1) {
    diff |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

function authorize(request: Request): { ok: true } | { ok: false; error: string } {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    /* Local/dev convenience — production must configure the secret. */
    if (process.env.NODE_ENV !== "production") return { ok: true };
    return {
      ok: false,
      error: "CRON_SECRET is not configured — set it to enable the purge job.",
    };
  }

  if (!secretMatches(request.headers.get("authorization"), secret)) {
    return { ok: false, error: "Unauthorized" };
  }

  return { ok: true };
}

async function runPurge(request: Request): Promise<Response> {
  const allowed = authorize(request);
  if (!allowed.ok) {
    const status = allowed.error === "Unauthorized" ? 401 : 503;
    return NextResponse.json({ ok: false, error: allowed.error }, { status });
  }

  const startedAt = Date.now();

  try {
    const { purged, skipped } = await purgeExpiredAdminUsers();

    /*
     * A cron run leaves no session and no UI, so the log line is the only
     * durable trace of a permanent delete. `warn` (not `info`) because the
     * repo's ESLint config allows exactly warn/error — and because a run that
     * skipped rows is a run a human should eventually read.
     */
    console.warn(
      `[cron] purge-trash: ${purged} deleted, ${skipped} skipped (still hold orders), retention ${TRASH_RETENTION_DAYS}d, ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      ok: true,
      source: "database",
      retentionDays: TRASH_RETENTION_DAYS,
      purged,
      skipped,
      tookMs: Date.now() - startedAt,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron] purge-trash failed", error);
    return NextResponse.json(
      { ok: false, error: "The purge job could not reach the database." },
      { status: 500 },
    );
  }
}

/** The schedule Vercel Cron calls. */
export async function GET(request: Request): Promise<Response> {
  return runPurge(request);
}

/**
 * Manual trigger (same auth): lets you run the sweep after changing the
 * retention window, or from any scheduler that only speaks POST.
 */
export async function POST(request: Request): Promise<Response> {
  return runPurge(request);
}
