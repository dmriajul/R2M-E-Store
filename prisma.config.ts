import { defineConfig } from "prisma/config";
import { loadEnvFiles } from "./prisma/load-env";

loadEnvFiles();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
