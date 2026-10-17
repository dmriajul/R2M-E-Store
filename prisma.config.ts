import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local automatically; the standalone Prisma CLI does not.
// Load the same environment before `npx prisma generate` / `db push` so local
// commands target the database used by `next dev`. Existing shell vars win.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
