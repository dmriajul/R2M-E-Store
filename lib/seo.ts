/**
 * Structured-data (JSON-LD) builders.
 *
 * Everything is a plain object so the pages can render it either on its own
 * (`<JsonLd data={organizationSchema()} />`) or inside a bigger `@graph`. All
 * URLs are absolute — Google ignores relative `@id`/`url` values.
 */

import { SITE } from "@/lib/site";
import { LEGAL_CONTENT } from "@/lib/legal-content";

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http")) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The store's logo — used by Organization/Product schema. */
export const LOGO_URL = absoluteUrl("/icons/icon-512.png");

export interface Crumb {
  name: string;
  href: string;
}

/** Schema.org Organization record for the storefront. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Little Luxe",
    alternateName: SITE.kidsBrand,
    url: SITE.url,
    logo: LOGO_URL,
    image: LOGO_URL,
    description: "Premium kids fashion in Bangladesh",
    email: "hello@littleluxe.com",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+8801707302038",
      contactType: "customer service",
      areaServed: "BD",
      availableLanguage: ["en", "bn"],
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "BD",
      addressLocality: "Dhaka",
    },
    sameAs: [] as string[],
  };
}

/** Schema.org BreadcrumbList for a trail of { name, href } pairs. */
export function breadcrumbSchema(trail: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.href),
    })),
  };
}

/**
 * Schema.org FAQPage built straight from the bilingual FAQ content, so the
 * structured data can never fall out of sync with what the page shows.
 */
export function faqSchema(lang: "en" | "bn" = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang === "bn" ? "bn-BD" : "en-BD",
    mainEntity: LEGAL_CONTENT.faq[lang].sections.map((section) => ({
      "@type": "Question",
      name: section.title,
      acceptedAnswer: {
        "@type": "Answer",
        text: section.paragraphs.join(" "),
      },
    })),
  };
}
