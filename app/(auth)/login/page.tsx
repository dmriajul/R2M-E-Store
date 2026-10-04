import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Access your LUXE account, orders and private list.",
};

export default function LoginPage() {
  return (
    <PagePlaceholder
      eyebrow="Account"
      title="Login"
      description="Authentication is not connected yet. The form, session handling and protected routes arrive once the auth provider is chosen."
      path="app/(auth)/login/page.tsx"
    />
  );
}
