import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { LEGAL_CONTENT, LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Terms & Conditions | MUKRA" },
  description:
    "The simple terms behind shopping at MUKRA — payments, delivery, returns and how we look after your information. Available in English and বাংলা.",
  keywords: ["terms and conditions", "mukra terms", "kids store policy"],
  openGraph: {
    title: "Terms & Conditions | MUKRA",
    description: "Everything you agree to when you order from MUKRA, in plain language.",
    type: "website",
    url: `${SITE.url}/terms`,
    siteName: SITE.kidsBrand,
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      content={LEGAL_CONTENT.terms}
      title={LEGAL_DOCS.terms.label}
      lastUpdated={LEGAL_UPDATED}
    />
  );
}
