/**
 * Minimal `.env` loader for CLI entry points.
 *
 * `next dev` and `next build` load `.env.local` automatically, but a script run
 * directly through `tsx` does not, and the Prisma CLI only reads `.env`.
 * Without this, `npm run db:seed` would not see `ADMIN_*` when the developer
 * followed the README advice and kept their configuration in `.env.local`.
 *
 * Precedence matches Next.js: variables already present in the real
 * environment always win, then `.env.local` overrides `.env`. Inline
 * assignments such as `ADMIN_EMAIL=you@example.com npm run db:seed` therefore
 * keep working.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** `KEY=value`, `export KEY=value`, with optional surrounding whitespace. */
const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function unquote(raw: string): string {
  const value = raw.trim();
  const first = value[0];
  const last = value[value.length - 1];

  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    const inner = value.slice(1, -1);
    return first === "\"" ? inner.replace(/\\n/g, "\n").replace(/\\"/g, "\"") : inner;
  }

  // Unquoted values: drop a trailing inline comment (`KEY=value # note`).
  const comment = value.indexOf(" #");
  return (comment === -1 ? value : value.slice(0, comment)).trim();
}

/**
 * Merges the given files into `process.env` without overwriting anything that
 * is already set. Returns the files that were actually read.
 */
export function loadEnvFiles(files: readonly string[] = [".env.local", ".env"]): string[] {
  const loaded: string[] = [];

  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    let contents: string;
    try {
      contents = readFileSync(path, "utf8");
    } catch {
      continue; // Unreadable file: the inline environment still applies.
    }

    for (const line of contents.split(/\r?\n/)) {
      if (!line || /^\s*#/.test(line)) continue;
      const match = ASSIGNMENT.exec(line);
      const key = match?.[1];
      const raw = match?.[2];
      if (key === undefined || raw === undefined) continue;
      if (process.env[key] !== undefined) continue; // Explicit environment wins.
      process.env[key] = unquote(raw);
    }

    loaded.push(file);
  }

  return loaded;
}
