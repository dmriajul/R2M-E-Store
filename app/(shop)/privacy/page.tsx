import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { LEGAL_CONTENT, LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy | LITTLE LUXE" },
  description:
    "What LITTLE LUXE collects, why we collect it and how to have it removed — written in plain language. No data selling, no invasive advertising cookies.",
  keywords: ["privacy policy", "data protection", "little luxe privacy", "cookie policy"],
  openGraph: {
    title: "Privacy Policy | LITTLE LUXE",
    description: "Plain-language privacy: what we keep, why we keep it, and how to remove it.",
    type: "website",
    url: `${SITE.url}/privacy`,
    siteName: SITE.kidsBrand,
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      content={LEGAL_CONTENT.privacy}
      title={LEGAL_DOCS.privacy.label}
      lastUpdated={LEGAL_UPDATED}
    />
  );
}
