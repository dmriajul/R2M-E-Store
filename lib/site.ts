import type { Product } from "@/types";

export const SITE = {
  name: "LUXE",
  tagline: "Objects of quiet distinction.",
  description:
    "LUXE is a curated house of modern luxury — timepieces, fragrance, leather and sound, selected for the few who notice the details.",
  url: "https://luxe.example.com",
} as const;

export interface NavLink {
  label: string;
  href: string;
}

/** Links rendered in the desktop navbar and the mobile sheet. */
export const NAV_LINKS: readonly NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/#collections" },
  { label: "About", href: "/#about" },
] as const;

export const FOOTER_LINKS: Readonly<Record<string, readonly NavLink[]>> = {
  Shop: [
    { label: "All Products", href: "/shop" },
    { label: "New Arrivals", href: "/shop?sort=new" },
    { label: "Best Sellers", href: "/shop?sort=popular" },
    { label: "Gift Cards", href: "/shop?category=gift-cards" },
  ],
  Support: [
    { label: "Contact", href: "/#contact" },
    { label: "Shipping & Returns", href: "/#shipping" },
    { label: "Order Tracking", href: "/#tracking" },
    { label: "FAQ", href: "/#faq" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/#privacy" },
    { label: "Terms of Service", href: "/#terms" },
    { label: "Cookie Policy", href: "/#cookies" },
    { label: "Accessibility", href: "/#accessibility" },
  ],
} as const;

/**
 * Mock catalogue used to seed the storefront until a database is connected.
 * Shape matches the `Product` type exactly, so swapping in a real data source
 * requires no component changes.
 */
export const MOCK_PRODUCTS: readonly Product[] = [
  {
    id: "prd_noir_chrono",
    slug: "noir-chronograph",
    name: "Noir Chronograph",
    tagline: "Sapphire glass, brushed titanium, 42mm.",
    description:
      "A restrained chronograph built around a Swiss automatic movement, finished in brushed titanium with a deep matte dial.",
    price: 2480,
    compareAtPrice: 2950,
    currency: "USD",
    images: ["/images/products/noir-chronograph-1.jpg"],
    category: "watches",
    tags: ["limited", "featured", "titanium"],
    rating: 4.9,
    reviewCount: 128,
    stock: 12,
    featured: true,
    status: "active",
    createdAt: "2026-01-18T10:00:00.000Z",
  },
  {
    id: "prd_oud_absolute",
    slug: "oud-absolute",
    name: "Oud Absolute",
    tagline: "Smoked oud, saffron, aged amber.",
    description:
      "An evening fragrance layered over smoked oud and saffron, drying down into aged amber and a whisper of leather.",
    price: 340,
    currency: "USD",
    images: ["/images/products/oud-absolute-1.jpg"],
    category: "fragrance",
    tags: ["bestseller", "unisex"],
    rating: 4.8,
    reviewCount: 412,
    stock: 40,
    featured: true,
    status: "active",
    createdAt: "2026-02-02T10:00:00.000Z",
  },
  {
    id: "prd_monolith_headphones",
    slug: "monolith-headphones",
    name: "Monolith Headphones",
    tagline: "Planar magnetic drivers, milled aluminium.",
    description:
      "Reference-grade planar magnetic drivers housed in a single billet of aluminium, tuned for an exceptionally quiet room.",
    price: 1290,
    currency: "USD",
    images: ["/images/products/monolith-headphones-1.jpg"],
    category: "audio",
    tags: ["new", "hi-fi"],
    rating: 4.7,
    reviewCount: 96,
    stock: 8,
    featured: false,
    status: "active",
    createdAt: "2026-03-11T10:00:00.000Z",
  },
  {
    id: "prd_vega_sunglasses",
    slug: "vega-sunglasses",
    name: "Vega Sunglasses",
    tagline: "Hand-polished acetate, mineral lenses.",
    description:
      "Hand-polished Italian acetate frames fitted with mineral glass lenses and titanium hinges.",
    price: 520,
    compareAtPrice: 620,
    currency: "USD",
    images: ["/images/products/vega-sunglasses-1.jpg"],
    category: "eyewear",
    tags: ["summer"],
    rating: 4.6,
    reviewCount: 74,
    stock: 25,
    featured: false,
    status: "active",
    createdAt: "2026-04-05T10:00:00.000Z",
  },
] as const;
