-- Additive change for an EXISTING MUKRA database. Apply with the deployment's
-- reviewed SQL workflow, before deploying the new app / generated Prisma client.
-- This is not a fresh-database baseline; this repo has no Prisma migration history.
--
-- Adds the admin-controlled 3-preset theme table used by the storefront theme
-- system (lib/theme-settings.ts, lib/data/theme-settings.ts, ThemeStyles).
-- A singleton row (id = 'global') holds the active preset and the three
-- customizable palettes. Theme selection/validation rules are enforced in
-- application code, not here.
BEGIN;
CREATE TABLE "ThemeSettings" (
  "id"          TEXT NOT NULL,
  "activeTheme" TEXT NOT NULL DEFAULT "light",
  "presets"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThemeSettings_pkey" PRIMARY KEY ("id")
);
-- No public policies: theme settings must only be accessed by the trusted
-- server DB role. Do NOT disable existing RLS. Ensure the app's server DB role
-- has required access.
ALTER TABLE "ThemeSettings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ThemeSettings" FROM PUBLIC;
COMMIT;
