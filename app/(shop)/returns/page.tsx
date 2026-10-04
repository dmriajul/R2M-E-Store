import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { LEGAL_CONTENT, LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Return & Refund Policy | LITTLE LUXE" },
  description:
    "30-day easy returns at LITTLE LUXE: what you can send back, what you can't, how refunds reach your bKash, Nagad or Rocket wallet, and free size exchanges.",
  keywords: ["return policy", "refund policy", "kids clothes exchange", "little luxe returns"],
  openGraph: {
    title: "Return & Refund Policy | LITTLE LUXE",
    description: "30 days to change your mind — free first exchange and refunds in 5–7 working days.",
    type: "website",
    url: `${SITE.url}/returns`,
    siteName: SITE.kidsBrand,
  },
};

export default function ReturnsPage() {
  return (
    <LegalPage
      content={LEGAL_CONTENT.returns}
      title={LEGAL_DOCS.returns.label}
      lastUpdated={LEGAL_UPDATED}
    />
  );
}
