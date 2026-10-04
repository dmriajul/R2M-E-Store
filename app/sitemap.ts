import type { MetadataRoute } from "next";
import { PRODUCTS, SITE } from "@/lib/site";

/**
 * Dynamic sitemap.
 *
 * Public routes only: the shop, every product, the five legal/help documents.
 * `/checkout`, `/dashboard/*`, `/admin/*`, `/api/*` and the upload route are
 * intentionally absent — they are private or transactional.
 *
 * Product `lastModified` prefers `updatedAt` and falls back to `createdAt`
 * (both are present on rows once Prisma is wired up; the seed catalogue carries
 * `createdAt` today).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /** Static routes: home, shop and the legal/help pages. */
  const staticRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/shipping", priority: 0.5, changeFrequency: "monthly" },
    { path: "/returns", priority: 0.5, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.4, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.4, changeFrequency: "monthly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE.url}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const productEntries: MetadataRoute.Sitemap = PRODUCTS.map((product) => ({
    url: `${SITE.url}/product/${product.id}`,
    lastModified: new Date(product.updatedAt ?? product.createdAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
