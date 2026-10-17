/** Private parent/child IPC only; never add a test endpoint or import this into app code. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function fixtureVerificationToken(email: string): Promise<string> {
  assert.equal(process.env.TEST_DATABASE_ADAPTER, "isolated");
  assert.ok(process.send, "Run npm run test:auth:contracts; private fixture IPC is required");
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { process.off("message", listener); reject(new Error("Fixture verification timed out")); }, 10_000);
    function listener(message: unknown) {
      if (!message || typeof message !== "object" || !("id" in message) || message.id !== id || !("type" in message) || message.type !== "verification-issued") return;
      clearTimeout(timeout);
      process.off("message", listener);
      process.channel?.unref();
      if ("token" in message && typeof message.token === "string" && /^[a-f0-9]{64}$/.test(message.token)) resolve(message.token);
      else reject(new Error("Fixture could not issue verification"));
    }
    process.on("message", listener);
    process.send!({ type: "issue-verification", email, id });
  });
}
