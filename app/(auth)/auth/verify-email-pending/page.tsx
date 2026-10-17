import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

export const metadata = { title: "Check your inbox | MUKRA" };

export default function VerifyEmailPendingPage() {
  return (
    <AuthCard>
      <MailCheck aria-hidden className="mx-auto mb-5 size-10 text-primary" />
      <h1 className="text-center text-3xl font-bold">Check your inbox</h1>
      <p className="mt-4 text-center text-sm leading-7 text-muted-foreground">
        Please check your inbox for a verification link to finish setting up your account.
      </p>
      <p className="mt-3 text-center text-xs leading-6 text-muted-foreground">
        The link expires in 24 hours. If it hasn&apos;t arrived, check spam or request a new link
        below.
      </p>
      <ResendVerificationForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Please verify your email before signing in. You can still{" "}
        <Link href="/shop" className="text-primary underline underline-offset-4">
          browse the shop
        </Link>{" "}
        while you wait.
      </p>
    </AuthCard>
  );
}
