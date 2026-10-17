/**
 * Test stub for the `server-only` marker package.
 *
 * `lib/data/media.ts` and `lib/cloudinary.ts` import `server-only` to keep API
 * secrets out of client bundles. Outside Next's react-server runtime that
 * marker is unresolvable (or throws), so tests/tsconfig.json maps it to this
 * no-op. Never imported by application code.
 */
export {};
