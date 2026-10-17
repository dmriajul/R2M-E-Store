-- Additive change for an EXISTING MUKRA database. Apply with the deployment's
-- reviewed SQL workflow, before deploying the new app / generated Prisma client.
-- This is not a fresh-database baseline; this repo has no Prisma migration history.
BEGIN;
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
CREATE TABLE "VerificationToken" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "resendWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerificationToken_identifier_key" ON "VerificationToken"("identifier");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE INDEX "VerificationToken_identifier_token_idx" ON "VerificationToken"("identifier", "token");
-- No public policies: tokens must only be accessed by the trusted server DB role.
-- Do NOT disable existing RLS. Ensure the app's server DB role has required access.
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "VerificationToken" FROM PUBLIC;
COMMIT;
