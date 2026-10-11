import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema } from "@/lib/seo";
import { LegalPage } from "@/components/layout/LegalPage";
import { LEGAL_CONTENT, LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "FAQ | MUKRA" },
  description:
    "Orders, payments, delivery times, sizes, exchanges and gift wrapping — the questions MUKRA customers ask most, answered in English and বাংলা.",
  keywords: ["kids clothing faq", "size guide help", "cash on delivery", "mukra help"],
  openGraph: {
    title: "FAQ | MUKRA",
    description: "Twelve questions, twelve short answers — order, pay, track, return.",
    type: "website",
    url: `${SITE.url}/faq`,
    siteName: SITE.kidsBrand,
  },
};

export default function FaqPage() {
  return (
    <>
      {/* FAQPage schema, generated from the same copy the page renders. */}
      <JsonLd id="faq-schema" data={faqSchema("en")} />
      <LegalPage
      content={LEGAL_CONTENT.faq}
        title={LEGAL_DOCS.faq.label}
        lastUpdated={LEGAL_UPDATED}
      />
    </>
  );
}
