-- Additive change for an EXISTING MUKRA database. Apply with the deployment's
-- reviewed SQL workflow, before deploying the new app / generated Prisma client.
-- This is not a fresh-database baseline; this repo has no Prisma migration history.
--
-- Adds the Google OAuth identity table used by Auth.js v5 (lib/auth.ts) to link
-- third-party identities to local Prisma users. Linking rules (provider-verified
-- email required, no auto-link by email match, no reactivation of soft-deleted
-- accounts) are enforced in application code, not here.
BEGIN;
CREATE TABLE "GoogleIdentity" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT "google",
  "providerAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT true,
  "name" TEXT,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoogleIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- One durable identity per (provider, providerAccountId): the same Google
-- account always resolves to the same row, so re-sign-ins never duplicate.
CREATE UNIQUE INDEX "GoogleIdentity_provider_providerAccountId_key" ON "GoogleIdentity"("provider", "providerAccountId");
CREATE INDEX "GoogleIdentity_userId_idx" ON "GoogleIdentity"("userId");
CREATE INDEX "GoogleIdentity_email_idx" ON "GoogleIdentity"("email");
-- No public policies: identities must only be accessed by the trusted server DB role.
-- Do NOT disable existing RLS. Ensure the app's server DB role has required access.
ALTER TABLE "GoogleIdentity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GoogleIdentity" FROM PUBLIC;
COMMIT;
