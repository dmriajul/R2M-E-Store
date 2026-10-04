import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Home",
  description:
    "LUXE — a curated house of modern luxury. Foundation build: design system, layout shell and cart store are in place.",
};

export default function HomePage() {
  return (
    <PagePlaceholder
      eyebrow="Step 1 · Foundation"
      title="Home"
      description="The design system, layout shell and cart store are live. The hero, collections grid and 3D showcase arrive in the next build step."
      path="app/(shop)/page.tsx"
    />
  );
}
