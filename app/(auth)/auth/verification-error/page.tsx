import Link from "next/link";
import { MailWarning } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

export const metadata = { title: "Request a new verification link | MUKRA" };

export default function VerificationErrorPage() {
  return (
    <AuthCard>
      <MailWarning aria-hidden className="mx-auto mb-5 size-10 text-primary" />
      <h1 className="text-center text-3xl font-bold">Let&apos;s try a fresh link</h1>
      <p className="mt-4 text-center text-sm leading-7 text-muted-foreground">
        This link may be invalid, expired, already used, or replaced by a newer email. Verification
        may also be temporarily unavailable. Request a new link below, or try again later.
      </p>
      <ResendVerificationForm />
      <Link
        href="/login"
        className="mt-6 block text-center text-sm text-primary underline underline-offset-4"
      >
        Back to login
      </Link>
    </AuthCard>
  );
}
