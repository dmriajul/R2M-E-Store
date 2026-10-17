// Finite local production-build regression runner. NEVER use with real credentials/data.
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

assert.ok(existsSync(".next/standalone/server.js"), "Run npm run build first");
assert.ok(!process.env.MAILJET_API_KEY && !process.env.MAILJET_SECRET_KEY && !process.env.DATABASE_URL && !process.env.AUTH_SECRET,
  "Run in a clean shell without real configuration");
const port = 3139;
const base = `http://localhost:${port}`;
const env = { ...process.env, NODE_ENV: "production", NODE_OPTIONS: "", PORT: String(port), HOSTNAME: "0.0.0.0",
  AUTH_URL: base, NEXTAUTH_URL: base, TEST_BASE_URL: base,
  AUTH_SECRET: "isolated-contract-secret-not-a-real-credential", AUTH_TRUST_HOST: "true",
  DATABASE_URL: "postgresql://isolated.invalid/mukra-test", TEST_DATABASE_ADAPTER: "isolated", TEST_ISOLATED_AUTH: "true",
  TURNSTILE_TEST_PROVIDER: "isolated", TURNSTILE_SECRET_KEY: "isolated-test-secret-not-a-live-key", TURNSTILE_ALLOWED_HOSTNAMES: "localhost",
  DEBUG_VERIFICATION_EMAILS: "false" };
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = fork(resolve(".next/standalone/server.js"), [], {
  env, execArgv: ["--import", resolve("tests/fixtures/auth.mjs")], stdio: ["ignore", "pipe", "pipe", "ipc"],
});
let child;
const watchdog = setTimeout(() => { console.error("Contract runner timed out"); child?.kill(); server.kill(); process.exitCode = 1; }, 120_000);
// No bearer links are logged in production. Keep the test output compact.
server.stderr.on("data", () => {});
server.on("message", (message) => {
  if (message?.type === "verification-issued" && child?.connected) child.send(message);
});
try {
  await new Promise((resolveReady, reject) => {
    server.stdout.on("data", (data) => { if (String(data).includes("Ready in")) resolveReady(); });
    server.once("exit", () => reject(new Error("Isolated server stopped before startup")));
    server.once("error", reject);
  });
  for (const script of ["http-auth-messages.ts", "http-turnstile.ts", "http-customer-journey.ts"]) {
    const code = await new Promise((resolveExit, reject) => {
      child = fork(resolve("node_modules/tsx/dist/cli.mjs"), ["--tsconfig", "tests/tsconfig.json", `tests/${script}`], {
        env, execArgv: [], stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
      child.on("message", (message) => {
        if (message?.type === "issue-verification" && server.connected) server.send(message);
      });
      child.once("exit", resolveExit);
      child.once("error", reject);
    });
    assert.equal(code, 0, `${script} failed`);
  }
} finally {
  clearTimeout(watchdog);
  child?.kill();
  server.kill();
}
