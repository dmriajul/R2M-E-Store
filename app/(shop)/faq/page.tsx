import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { LEGAL_CONTENT, LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "FAQ | LITTLE LUXE" },
  description:
    "Orders, payments, delivery times, sizes, exchanges and gift wrapping — the questions LITTLE LUXE customers ask most, answered in English and বাংলা.",
  keywords: ["kids clothing faq", "size guide help", "cash on delivery", "little luxe help"],
  openGraph: {
    title: "FAQ | LITTLE LUXE",
    description: "Twelve questions, twelve short answers — order, pay, track, return.",
    type: "website",
    url: `${SITE.url}/faq`,
    siteName: SITE.kidsBrand,
  },
};

export default function FaqPage() {
  return (
    <LegalPage
      content={LEGAL_CONTENT.faq}
      title={LEGAL_DOCS.faq.label}
      lastUpdated={LEGAL_UPDATED}
    />
  );
}
