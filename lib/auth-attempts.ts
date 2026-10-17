/** Server-only process-local lockout/audit shared by Credentials and the login API. */
import { createHmac, randomBytes } from "node:crypto";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export interface FailedLoginAuditEntry {
  /** Opaque process-keyed identifiers; never raw email/IP or passwords/tokens. */
  accountId: string;
  reason: "invalid-credentials" | "account-locked";
  attemptCount: number;
  timestamp: string;
}
const scope = globalThis as typeof globalThis & { __mukraAuthAttempts?: {
  secret: Buffer; hits: Map<string, number[]>; audit: FailedLoginAuditEntry[]; lastSweep: number;
} };
const state: NonNullable<typeof scope.__mukraAuthAttempts> = scope.__mukraAuthAttempts ??= { secret: randomBytes(32), hits: new Map(), audit: [], lastSweep: Date.now() };
function key(kind: "email" | "ip", value: string): string {
  return `${kind}:${createHmac("sha256", state.secret).update(value).digest("hex")}`;
}
function active(id: string, now = Date.now()): number[] {
  const hits = (state.hits.get(id) ?? []).filter((stamp) => now - stamp < LOGIN_LOCKOUT_WINDOW_MS);
  if (hits.length) state.hits.set(id, hits); else state.hits.delete(id);
  return hits;
}
function sweep(now: number) {
  if (now - state.lastSweep < LOGIN_LOCKOUT_WINDOW_MS && state.hits.size < 10_000) return;
  for (const id of state.hits.keys()) active(id, now);
  state.lastSweep = now;
}
export function isAccountLocked(email: string, ip?: string): boolean {
  sweep(Date.now());
  return active(key("email", email.trim().toLowerCase())).length >= MAX_LOGIN_ATTEMPTS ||
    Boolean(ip && ip !== "anonymous" && active(key("ip", ip)).length >= MAX_LOGIN_ATTEMPTS * 2);
}
export function recordFailedLoginAttempt(email: string, ip?: string): boolean {
  const now = Date.now();
  sweep(now);
  const accountId = key("email", email.trim().toLowerCase());
  const ids = [accountId, ...(ip && ip !== "anonymous" ? [key("ip", ip)] : [])];
  for (const id of ids) {
    // Bound cardinality under malicious distributed inputs as well as normal expiry.
    if (!state.hits.has(id) && state.hits.size >= 10_000) state.hits.delete(state.hits.keys().next().value!);
    state.hits.set(id, [...active(id, now), now]);
  }
  const locked = isAccountLocked(email, ip);
  const entry: FailedLoginAuditEntry = { accountId, reason: locked ? "account-locked" : "invalid-credentials",
    attemptCount: active(accountId, now).length, timestamp: new Date(now).toISOString() };
  state.audit.unshift(entry);
  state.audit.length = Math.min(state.audit.length, 200);
  console.warn("[auth:security] Sign-in rejected", entry);
  return locked;
}
export function clearFailedLoginAttempts(email: string): void { state.hits.delete(key("email", email.trim().toLowerCase())); }
/** Test/operations utility, not exposed through any route or client action. */
export function resetLoginRateLimits(email?: string): void {
  if (email) clearFailedLoginAttempts(email); else state.hits.clear();
}
export function getFailedLoginAuditLog(): readonly FailedLoginAuditEntry[] { return state.audit.map((entry) => ({ ...entry })); }
