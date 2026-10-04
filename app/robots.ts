import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * robots.txt — everything public is crawlable, the private surfaces are not.
 *
 * `/admin`, `/dashboard` and `/checkout` are also marked `noindex` in their own
 * metadata; the directives here stop crawlers from fetching them at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/checkout", "/api/", "/offline"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
