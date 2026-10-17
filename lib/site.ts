import type {
  AgeFilter,
  Product,
  ProductBadge,
  ProductCategory,
  ProductGender,
} from "@/types";

export const SITE = {
  name: "MUKRA",
  /** Kids line — used by the shop/product metadata and headings. */
  kidsBrand: "MUKRA",
  tagline: "Where Magic Meets Style",
  kidsTagline: "আপনার স্নিগ্ধ ছোটদের জন্য সুন্দর পোশাক ✨",
  description:
    "MUKRA brings premium fashion to Bangladesh — Where Magic Meets Style. Discover beautifully crafted outfits for ages 0-12.",
  /**
   * Canonical origin: metadataBase, canonicals, sitemap, robots and OG images
   * all derive from this. Override with NEXT_PUBLIC_SITE_URL on previews.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://mukra.com",
} as const;

export interface NavLink {
  label: string;
  href: string;
}

/** Links rendered in the desktop navbar and the mobile sheet. */
export const NAV_LINKS: readonly NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/collections" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

/** Outline text rolled in the home-page marquee. */
export const MARQUEE_WORDS: readonly string[] = [
  "MUKRA",
  "LUXURY",
  "CRAFTSMANSHIP",
  "KIDS FASHION",
  "ELEGANCE",
  "EXCLUSIVITY",
] as const;

export const FOOTER_LINKS: Readonly<Record<string, readonly NavLink[]>> = {
  Shop: [
    { label: "All Products", href: "/shop" },
    { label: "New Arrivals", href: "/shop?sort=newest" },
    { label: "Best Sellers", href: "/shop?sort=rating" },
    { label: "Accessories", href: "/shop?category=accessories" },
  ],
  Support: [
    { label: "Contact", href: "/contact" },
    { label: "Order Tracking", href: "/dashboard/orders" },
    { label: "Shipping Info", href: "/shipping" },
    { label: "FAQ", href: "/faq" },
    { label: "Size Guide", href: "/size-guide" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Returns & Refunds", href: "/returns" },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*  Filters                                                                   */
/* -------------------------------------------------------------------------- */

export const categories = [
  "All",
  "Jackets & Coats",
  "Sweatshirts & Hoodies",
  "Sweaters & Cardigans",
  "Winter Bottoms / Trousers",
  "Winter Sets & Tracksuits",
  "Tops & Tees",
  "Innerwear & Thermals",
  "Accessories",
] as const satisfies readonly (ProductCategory | "All")[];

export type CategoryFilter = (typeof categories)[number];

export const ageFilters = [
  "All Ages",
  "0-2Y",
  "3-5Y",
  "6-8Y",
  "9-12Y",
] as const satisfies readonly AgeFilter[];

export const genderFilters = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "girls", label: "Girls", emoji: "👧" },
  { value: "boys", label: "Boys", emoji: "👦" },
  { value: "unisex", label: "Unisex", emoji: "🧒" },
] as const;

export type GenderFilterValue = (typeof genderFilters)[number]["value"];

export const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top Rated" },
] as const;

export type SortValue = (typeof sortOptions)[number]["value"];

/* -------------------------------------------------------------------------- */
/*  Presentation metadata                                                     */
/* -------------------------------------------------------------------------- */

export interface CategoryMeta {
  /** URL-safe key used by `?category=`. */
  slug: string;
  emoji: string;
  /** Tailwind gradient stops for the placeholder artwork. */
  gradient: string;
  /*  * Soft glow colour used for shadows and decorative highlights. */
  glow: string;
}

export const CATEGORY_META: Readonly<Record<ProductCategory, CategoryMeta>> = {
  "Jackets & Coats": {
    slug: "jackets-coats",
    emoji: "🧥",
    gradient: "from-teal-400 to-emerald-600",
    glow: "#2DD4BF",
  },
  "Sweatshirts & Hoodies": {
    slug: "sweatshirts-hoodies",
    emoji: "🧥",
    gradient: "from-violet-400 to-purple-600",
    glow: "#A78BFA",
  },
  "Sweaters & Cardigans": {
    slug: "sweaters-cardigans",
    emoji: "🧶",
    gradient: "from-amber-400 to-orange-600",
    glow: "#F59E0B",
  },
  "Winter Bottoms / Trousers": {
    slug: "winter-bottoms-trousers",
    emoji: "👖",
    gradient: "from-blue-400 to-indigo-600",
    glow: "#60A5FA",
  },
  "Winter Sets & Tracksuits": {
    slug: "winter-sets-tracksuits",
    emoji: "🧸",
    gradient: "from-pink-400 to-rose-600",
    glow: "#F472B6",
  },
  "Tops & Tees": {
    slug: "tops-tees",
    emoji: "👕",
    gradient: "from-sky-400 to-blue-600",
    glow: "#38BDF8",
  },
  "Innerwear & Thermals": {
    slug: "innerwear-thermals",
    emoji: "🧦",
    gradient: "from-cyan-400 to-sky-600",
    glow: "#22D3EE",
  },
  Accessories: {
    slug: "accessories",
    emoji: "👑",
    gradient: "from-yellow-300 to-amber-500",
    glow: "#FACC15",
  },
} as const;

/** Badge palette: New = cyan, Sale = rose, Bestseller = gold, Organic = green. */
export const BADGE_STYLES: Readonly<Record<ProductBadge, string>> = {
  New: "bg-cyan/15 text-cyan border-cyan/40",
  Sale: "bg-rose/20 text-rose border-rose/45",
  Bestseller: "bg-primary/20 text-primary border-primary/45",
  Organic: "bg-emerald-500/18 text-emerald-400 border-emerald-500/40",
} as const;

export const GENDER_EMOJI: Readonly<Record<ProductGender, string>> = {
  Girls: "👧",
  Boys: "👦",
  Unisex: "🧒",
} as const;

/** Colour-name → swatch. Names not listed fall back to a neutral chip. */
export const COLOR_HEX: Readonly<Record<string, string>> = {
  Pink: "#F472B6",
  Rose: "#FB7185",
  Lavender: "#A78BFA",
  Purple: "#A855F7",
  White: "#FAFAFA",
  Cream: "#FDF6E3",
  Yellow: "#FACC15",
  Amber: "#F59E0B",
  Mint: "#6EE7B7",
  Teal: "#2DD4BF",
  Sky: "#38BDF8",
  Blue: "#3B82F6",
  Navy: "#1E3A8A",
  Denim: "#4F6D9A",
  Red: "#EF4444",
  Grey: "#9CA3AF",
  Charcoal: "#374151",
  Beige: "#E7D3B3",
  Black: "#1F2937",
  Green: "#22C55E",
} as const;

export const DEFAULT_SWATCH = "#9CA3AF";

/* -------------------------------------------------------------------------- */
/*  Queries                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProductQuery {
  category?: string;
  age?: string;
  gender?: string;
  sort?: string;
  search?: string;
  limit?: number;
}

/** "3-6Y" → [3, 6]. Falls back to [0, 12] for anything unparseable. */
export function parseAgeRange(range: string): [number, number] {
  const parts = range.replace(/[^0-9-]/g, "").split("-");
  const min = Number.parseInt(parts[0] ?? "", 10);
  const max = Number.parseInt(parts[1] ?? "", 10);

  if (Number.isNaN(min)) return [0, 12];
  if (Number.isNaN(max)) return [min, min];
  return [min, max];
}

/** True when a product's age span overlaps the selected filter bucket. */
export function ageMatchesFilter(range: string, filter: string): boolean {
  if (filter === "All Ages") return true;

  const [productMin, productMax] = parseAgeRange(range);
  const [filterMin, filterMax] = parseAgeRange(filter);

  return productMin <= filterMax && filterMin <= productMax;
}

function sortProducts(products: Product[], sort: string): Product[] {
  const sorted = [...products];

  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "rating":
      return sorted.sort(
        (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      );
    case "featured":
    default:
      return sorted.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0) ||
          b.rating - a.rating ||
          b.reviewCount - a.reviewCount,
      );
  }
}

/**
 * Filter + sort the catalogue. Runs on the server (initial URL state) and in
 * the client (instant filtering) from the same source of truth.
 *
 * Gender note: picking "Girls" also returns Unisex pieces, since those are
 * wearable by girls — only the explicit "Unisex" pill narrows to Unisex alone.
 */
export function getProducts(query: ProductQuery = {}, catalogue: readonly Product[]): Product[] {
  const {
    category = "All",
    age = "All Ages",
    gender = "all",
    sort = "featured",
    search,
    limit,
  } = query;

  let products = catalogue.filter((product) => product.status === "active");

  if (category && category !== "All") {
    products = products.filter(
      (product) =>
        product.category === category ||
        product.categories?.some((assignedCategory) => assignedCategory === category),
    );
  }

  if (age && age !== "All Ages") {
    products = products.filter((product) => ageMatchesFilter(product.ageRange, age));
  }

  if (gender && gender !== "all") {
    const wanted =
      gender === "girls"
        ? ["Girls", "Unisex"]
        : gender === "boys"
          ? ["Boys", "Unisex"]
          : ["Unisex"];

    products = products.filter((product) => wanted.includes(product.gender));
  }

  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    products = products.filter((product) =>
      [
        product.name,
        product.tagline,
        product.category,
        product.material,
        product.ageRange,
        ...product.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }

  const sorted = sortProducts(products, sort);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

/** Category slug ⇄ label helpers for URL state. */
export function categoryToSlug(label: string): string {
  if (label === "All") return "all";
  const match = Object.entries(CATEGORY_META).find(([key]) => key === label);
  return match ? match[1].slug : "all";
}

export function categoryFromSlug(slug: string): CategoryFilter {
  if (!slug || slug === "all") return "All";

  const match = Object.entries(CATEGORY_META).find(([, meta]) => meta.slug === slug);
  return match ? (match[0] as ProductCategory) : "All";
}

/* -------------------------------------------------------------------------- */
/*  Editorial content used by the product page                                */
/* -------------------------------------------------------------------------- */

export const CARE_INSTRUCTIONS =
  "Machine wash cold with like colours, tumble dry low, warm iron if needed. Do not bleach.";

export interface SizeChartRow {
  size: string;
  age: string;
  height: string;
  chest: string;
  waist: string;
}

export const SIZE_CHART: readonly SizeChartRow[] = [
  { size: "2T", age: "2 years", height: "86–92 cm", chest: "52 cm", waist: "50 cm" },
  { size: "3T", age: "3 years", height: "92–98 cm", chest: "54 cm", waist: "52 cm" },
  { size: "4T", age: "4 years", height: "98–104 cm", chest: "56 cm", waist: "53 cm" },
  { size: "5", age: "5 years", height: "104–110 cm", chest: "58 cm", waist: "54 cm" },
  { size: "6", age: "6 years", height: "110–116 cm", chest: "60 cm", waist: "55 cm" },
  { size: "7", age: "7 years", height: "116–122 cm", chest: "62 cm", waist: "56 cm" },
  { size: "8", age: "8 years", height: "122–128 cm", chest: "64 cm", waist: "57 cm" },
  { size: "10", age: "9–10 years", height: "128–140 cm", chest: "68 cm", waist: "59 cm" },
  { size: "12", age: "11–12 years", height: "140–152 cm", chest: "72 cm", waist: "62 cm" },
] as const;

/** Shown as a row of reassurance chips under the buy box. */
export const TRUST_BADGES = [
  { emoji: "🚚", label: "Free Shipping over ৳5,000" },
  { emoji: "🔄", label: "30-Day Easy Returns" },
  { emoji: "🌿", label: "Kid-Safe Materials" },
  { emoji: "✅", label: "Quality Guaranteed" },
] as const;
