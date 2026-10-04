import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Admin",
  description: "LUXE operations console.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <PagePlaceholder
      eyebrow="Operations"
      title="Admin"
      description="Product, order and inventory management. Still to come — no database is connected in this step, so this console is a placeholder."
      path="app/admin/page.tsx"
    />
  );
}
