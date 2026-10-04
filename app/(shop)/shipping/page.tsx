import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { LEGAL_CONTENT, LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Shipping Information | LITTLE LUXE" },
  description:
    "LITTLE LUXE delivery across all 64 districts of Bangladesh: free over ৳500, flat ৳60 otherwise, 1–2 working days inside Dhaka and 3–5 days everywhere else.",
  keywords: [
    "kids clothes delivery",
    "shipping charges Bangladesh",
    "cash on delivery kids store",
    "order tracking",
  ],
  openGraph: {
    title: "Shipping Information | LITTLE LUXE",
    description: "Free delivery over ৳500 — 1–2 days in Dhaka, 3–5 days across Bangladesh.",
    type: "website",
    url: `${SITE.url}/shipping`,
    siteName: SITE.kidsBrand,
  },
};

export default function ShippingPage() {
  return (
    <LegalPage
      content={LEGAL_CONTENT.shipping}
      title={LEGAL_DOCS.shipping.label}
      lastUpdated={LEGAL_UPDATED}
    />
  );
}
