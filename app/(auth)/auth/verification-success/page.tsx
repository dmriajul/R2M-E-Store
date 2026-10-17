import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Email verified | MUKRA" };

export default function VerificationSuccessPage() {
  return (
    <AuthCard>
      <BadgeCheck aria-hidden className="mx-auto mb-5 size-12 text-primary" />
      <h1 className="text-center text-3xl font-bold">Email verified</h1>
      <p className="mt-4 text-center text-sm leading-7 text-muted-foreground">
        Thank you for confirming your email. Your MUKRA account is ready for your next little
        adventure.
      </p>
      <Button asChild className="mt-7 h-12 w-full rounded-full">
        <Link href="/login">Go to Login</Link>
      </Button>
    </AuthCard>
  );
}
