import type {
  AgeFilter,
  Product,
  ProductBadge,
  ProductCategory,
  ProductGender,
  Review,
} from "@/types";

export const SITE = {
  name: "LUXE",
  /** Kids line — used by the shop/product metadata and headings. */
  kidsBrand: "LITTLE LUXE",
  tagline: "Objects of quiet distinction.",
  kidsTagline: "Adorable styles for your little ones ✨",
  description:
    "LUXE is a curated house of modern luxury — now for the small ones too. Organic fabrics, playful details and clothes built to survive the playground.",
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

/** Outline text rolled in the home-page marquee. */
export const MARQUEE_WORDS: readonly string[] = [
  "LUXURY",
  "CRAFTSMANSHIP",
  "INNOVATION",
  "PREMIUM",
  "EXCLUSIVE",
] as const;

export const FOOTER_LINKS: Readonly<Record<string, readonly NavLink[]>> = {
  Shop: [
    { label: "All Products", href: "/shop" },
    { label: "New Arrivals", href: "/shop?sort=newest" },
    { label: "Best Sellers", href: "/shop?sort=rating" },
    { label: "Gift Cards", href: "/shop?category=accessories" },
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

/* -------------------------------------------------------------------------- */
/*  Filters                                                                   */
/* -------------------------------------------------------------------------- */

export const categories = [
  "All",
  "Dresses",
  "Tops & Tees",
  "Bottoms",
  "Shoes",
  "Outerwear",
  "Accessories",
] as const satisfies readonly (ProductCategory | "All")[];

export type CategoryFilter = (typeof categories)[number];

export const ageFilters = [
  "All Ages",
  "0-2Y",
  "3-5Y",
  "6-8Y",
  "9-14Y",
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
  /** Soft glow colour used for shadows and 3D lighting. */
  glow: string;
}

export const CATEGORY_META: Readonly<Record<ProductCategory, CategoryMeta>> = {
  Dresses: {
    slug: "dresses",
    emoji: "👗",
    gradient: "from-pink-400 to-rose-600",
    glow: "#F472B6",
  },
  "Tops & Tees": {
    slug: "tops-tees",
    emoji: "👕",
    gradient: "from-sky-400 to-blue-600",
    glow: "#38BDF8",
  },
  Bottoms: {
    slug: "bottoms",
    emoji: "👖",
    gradient: "from-violet-400 to-purple-600",
    glow: "#A78BFA",
  },
  Shoes: {
    slug: "shoes",
    emoji: "👟",
    gradient: "from-amber-400 to-orange-600",
    glow: "#F59E0B",
  },
  Outerwear: {
    slug: "outerwear",
    emoji: "🧥",
    gradient: "from-teal-400 to-emerald-600",
    glow: "#2DD4BF",
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
/*  Catalogue                                                                 */
/* -------------------------------------------------------------------------- */

type ProductSeed = Omit<Product, "inStock" | "compareAtPrice" | "images">;

const PRODUCT_SEEDS: readonly ProductSeed[] = [
  {
    id: "floral-summer-dress",
    slug: "floral-summer-dress",
    name: "Floral Summer Dress",
    tagline: "Twirl-ready organic cotton with a sunshine print.",
    description:
      "A breezy A-line dress in breathable organic cotton that keeps little ones cool on warm days. The hidden back buttons make dressing quick, and the full skirt is made for spinning.",
    price: 34.99,
    currency: "USD",
    category: "Dresses",
    ageRange: "3-6Y",
    gender: "Girls",
    colors: ["Pink", "Lavender", "White"],
    sizes: ["2T", "3T", "4T", "5", "6"],
    material: "100% Organic Cotton",
    badge: "Bestseller",
    modelColor: "#F472B6",
    tags: ["dresses", "organic", "summer", "twirl"],
    rating: 4.8,
    reviewCount: 124,
    stock: 26,
    featured: true,
    status: "active",
    createdAt: "2026-03-18T10:00:00.000Z",
  },
  {
    id: "dino-graphic-tee",
    slug: "dino-graphic-tee",
    name: "Dino Graphic Tee",
    tagline: "Roar-some print on super-soft jersey.",
    description:
      "Soft cotton jersey with a water-based dinosaur print that stays bright wash after wash. The relaxed neckline pulls on easily and never scratches.",
    price: 19.99,
    currency: "USD",
    category: "Tops & Tees",
    ageRange: "4-8Y",
    gender: "Boys",
    colors: ["Mint", "Navy", "White"],
    sizes: ["3T", "4T", "5", "6", "7", "8"],
    material: "Soft Cotton Jersey",
    badge: "New",
    modelColor: "#2DD4BF",
    tags: ["tops", "tshirt", "dino", "everyday"],
    rating: 4.6,
    reviewCount: 98,
    stock: 40,
    featured: true,
    status: "active",
    createdAt: "2026-04-02T10:00:00.000Z",
  },
  {
    id: "rainbow-tutu-skirt",
    slug: "rainbow-tutu-skirt",
    name: "Rainbow Tutu Skirt",
    tagline: "Layers of soft tulle with a rainbow waistband.",
    description:
      "Feather-light tulle layered over a cotton lining so it never itches. The elasticated rainbow waistband grows with them and stays put through the wiggliest of days.",
    price: 27.99,
    currency: "USD",
    category: "Bottoms",
    ageRange: "2-5Y",
    gender: "Girls",
    colors: ["Pink", "Purple", "Yellow"],
    sizes: ["2T", "3T", "4T", "5"],
    material: "Tulle & Cotton Blend",
    badge: "New",
    modelColor: "#A78BFA",
    tags: ["bottoms", "skirt", "tutu", "party"],
    rating: 4.7,
    reviewCount: 76,
    stock: 31,
    featured: false,
    status: "active",
    createdAt: "2026-03-29T10:00:00.000Z",
  },
  {
    id: "light-up-sneakers",
    slug: "light-up-sneakers",
    name: "Light-Up Sneakers",
    tagline: "Every step lights up in colour.",
    description:
      "Vegan leather uppers with a cushioned mesh lining and LED soles that flash as they walk. Easy velcro straps mean no laces to learn — and no morning battles.",
    price: 44.99,
    currency: "USD",
    category: "Shoes",
    ageRange: "5-10Y",
    gender: "Unisex",
    colors: ["White", "Blue", "Black"],
    sizes: ["10", "11", "12", "13", "1", "2"],
    material: "Vegan Leather & Mesh",
    badge: "Bestseller",
    modelColor: "#38BDF8",
    tags: ["shoes", "sneakers", "light-up", "active"],
    rating: 4.9,
    reviewCount: 210,
    stock: 18,
    featured: true,
    status: "active",
    createdAt: "2026-02-14T10:00:00.000Z",
  },
  {
    id: "cozy-bear-hoodie",
    slug: "cozy-bear-hoodie",
    name: "Cozy Bear Hoodie",
    tagline: "Fleece-lined hood with the cutest little ears.",
    description:
      "Brushed fleece inside organic cotton keeps them warm without bulk. Three-dimensional bear ears on the hood and a kangaroo pocket for treasures found along the way.",
    price: 39.99,
    currency: "USD",
    category: "Outerwear",
    ageRange: "3-7Y",
    gender: "Unisex",
    colors: ["Cream", "Beige", "Grey"],
    sizes: ["2T", "3T", "4T", "5", "6"],
    material: "Fleece-Backed Organic Cotton",
    badge: "Organic",
    modelColor: "#E7D3B3",
    tags: ["outerwear", "hoodie", "organic", "winter"],
    rating: 4.8,
    reviewCount: 152,
    stock: 22,
    featured: false,
    status: "active",
    createdAt: "2026-01-26T10:00:00.000Z",
  },
  {
    id: "butterfly-hair-clips",
    slug: "butterfly-hair-clips",
    name: "Butterfly Hair Clips Set",
    tagline: "Six sparkly clips, endless hairstyles.",
    description:
      "A set of six butterfly clips made from smooth recycled acetate with rounded edges that never tug. Strong enough for a full day of play, gentle enough for fine hair.",
    price: 12.99,
    currency: "USD",
    category: "Accessories",
    ageRange: "2-8Y",
    gender: "Girls",
    colors: ["Lavender", "Pink", "Rose"],
    sizes: ["One Size"],
    material: "Recycled Acetate",
    badge: "New",
    modelColor: "#C084FC",
    tags: ["accessories", "hair", "clips", "gift"],
    rating: 4.5,
    reviewCount: 64,
    stock: 60,
    featured: false,
    status: "active",
    createdAt: "2026-04-06T10:00:00.000Z",
  },
  {
    id: "princess-party-gown",
    slug: "princess-party-gown",
    name: "Princess Party Gown",
    tagline: "Satin bodice, full tulle skirt, proper sparkle.",
    description:
      "A proper party gown with a soft satin bodice and a layered tulle skirt lined in cotton, so nothing scratches. Machine washable — because celebrations get messy.",
    price: 59.99,
    originalPrice: 79.99,
    currency: "USD",
    category: "Dresses",
    ageRange: "4-8Y",
    gender: "Girls",
    colors: ["Lavender", "White", "Rose"],
    sizes: ["3T", "4T", "5", "6", "7"],
    material: "Satin & Tulle",
    badge: "Sale",
    modelColor: "#C084FC",
    tags: ["dresses", "party", "occasion", "sale"],
    rating: 4.9,
    reviewCount: 187,
    stock: 12,
    featured: true,
    status: "active",
    createdAt: "2026-02-08T10:00:00.000Z",
  },
  {
    id: "space-explorer-jacket",
    slug: "space-explorer-jacket",
    name: "Space Explorer Jacket",
    tagline: "Water-resistant shell with glow-in-the-dark planets.",
    description:
      "A lightweight recycled shell that shrugs off drizzle, lined with soft jersey for warmth. Glow-in-the-dark planet patches make it a favourite for night-time adventurers.",
    price: 49.99,
    currency: "USD",
    category: "Outerwear",
    ageRange: "6-12Y",
    gender: "Boys",
    colors: ["Navy", "Grey", "Sky"],
    sizes: ["5", "6", "7", "8", "10", "12"],
    material: "Recycled Polyester Shell",
    badge: "Bestseller",
    modelColor: "#1E3A8A",
    tags: ["outerwear", "jacket", "rain", "space"],
    rating: 4.7,
    reviewCount: 141,
    stock: 20,
    featured: false,
    status: "active",
    createdAt: "2026-01-09T10:00:00.000Z",
  },
  {
    id: "denim-dungaree-set",
    slug: "denim-dungaree-set",
    name: "Denim Dungaree Set",
    tagline: "Classic dungarees in softly washed denim.",
    description:
      "Pre-washed cotton denim that feels broken-in from day one, with adjustable straps that grow with them. Popper legs make nappy changes and toilet trips quick work.",
    price: 36.99,
    currency: "USD",
    category: "Bottoms",
    ageRange: "1-4Y",
    gender: "Unisex",
    colors: ["Denim", "Blue", "Cream"],
    sizes: ["12M", "18M", "2T", "3T", "4T"],
    material: "Soft Cotton Denim",
    modelColor: "#4F6D9A",
    tags: ["bottoms", "dungarees", "denim", "toddler"],
    rating: 4.6,
    reviewCount: 88,
    stock: 27,
    featured: false,
    status: "active",
    createdAt: "2026-01-02T10:00:00.000Z",
  },
  {
    id: "unicorn-backpack",
    slug: "unicorn-backpack",
    name: "Unicorn Backpack",
    tagline: "Padded straps, magic horn, room for snacks.",
    description:
      "A small-person backpack with wide padded straps that sit comfortably on little shoulders. Water-resistant lining, an insulated snack pocket and a shimmering unicorn horn.",
    price: 24.99,
    currency: "USD",
    category: "Accessories",
    ageRange: "3-8Y",
    gender: "Girls",
    colors: ["Pink", "Lavender", "Mint"],
    sizes: ["One Size"],
    material: "Water-Resistant Recycled Polyester",
    badge: "Bestseller",
    modelColor: "#F472B6",
    tags: ["accessories", "backpack", "school", "unicorn"],
    rating: 4.8,
    reviewCount: 176,
    stock: 35,
    featured: false,
    status: "active",
    createdAt: "2026-02-22T10:00:00.000Z",
  },
  {
    id: "cotton-pajama-set",
    slug: "cotton-pajama-set",
    name: "Cotton Pajama Set",
    tagline: "Buttery-soft organic cotton for long sleeps.",
    description:
      "Snug-fit shorts and a matching tee in GOTS-certified organic cotton that gets softer with every wash. Flat seams and a covered waistband mean no midnight fidgeting.",
    price: 22.99,
    currency: "USD",
    category: "Tops & Tees",
    ageRange: "2-6Y",
    gender: "Unisex",
    colors: ["Sky", "Cream", "Grey"],
    sizes: ["2T", "3T", "4T", "5", "6"],
    material: "100% Organic Cotton",
    badge: "Organic",
    modelColor: "#60A5FA",
    tags: ["tops", "pajamas", "organic", "sleep"],
    rating: 4.9,
    reviewCount: 203,
    stock: 44,
    featured: false,
    status: "active",
    createdAt: "2026-03-05T10:00:00.000Z",
  },
  {
    id: "velvet-mary-janes",
    slug: "velvet-mary-janes",
    name: "Velvet Mary Janes",
    tagline: "Party shoes that stay comfortable all day.",
    description:
      "Velvet uppers over a padded leather insole with a flexible rubber sole — dressy enough for a wedding, forgiving enough for the dance floor afterwards.",
    price: 38.99,
    currency: "USD",
    category: "Shoes",
    ageRange: "3-7Y",
    gender: "Girls",
    colors: ["Rose", "Black", "Cream"],
    sizes: ["8", "9", "10", "11", "12", "13"],
    material: "Velvet & Leather",
    modelColor: "#FB7185",
    tags: ["shoes", "mary-janes", "party", "velvet"],
    rating: 4.4,
    reviewCount: 57,
    stock: 0,
    featured: false,
    status: "active",
    createdAt: "2026-01-15T10:00:00.000Z",
  },
] as const;

/**
 * The catalogue. `inStock`, placeholder `images` and the back-compat
 * `compareAtPrice` alias are derived here so the seed data stays DRY.
 */
export const PRODUCTS: readonly Product[] = PRODUCT_SEEDS.map((seed) => ({
  ...seed,
  images: Array.from({ length: 4 }, (_, index) => `${seed.slug}-${index + 1}`),
  inStock: seed.stock > 0,
  compareAtPrice: seed.originalPrice,
}));

/**
 * @deprecated Kept as the alias the Step 2 home page, search dialog and
 * `/api/products` already import. New code should use `PRODUCTS`/`getProducts`.
 */
export const MOCK_PRODUCTS: readonly Product[] = PRODUCTS;

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

/** "3-6Y" → [3, 6]. Falls back to [0, 14] for anything unparseable. */
export function parseAgeRange(range: string): [number, number] {
  const parts = range.replace(/[^0-9-]/g, "").split("-");
  const min = Number.parseInt(parts[0] ?? "", 10);
  const max = Number.parseInt(parts[1] ?? "", 10);

  if (Number.isNaN(min)) return [0, 14];
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
export function getProducts(query: ProductQuery = {}): Product[] {
  const {
    category = "All",
    age = "All Ages",
    gender = "all",
    sort = "featured",
    search,
    limit,
  } = query;

  let products = PRODUCTS.filter((product) => product.status === "active");

  if (category && category !== "All") {
    products = products.filter((product) => product.category === category);
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

/** Look up by id (ids are slugs, e.g. "floral-summer-dress"). */
export function getProductById(id: string): Product | undefined {
  const normalised = decodeURIComponent(id).toLowerCase();

  return (
    PRODUCTS.find((product) => product.id === normalised) ??
    PRODUCTS.find((product) => product.slug === normalised)
  );
}

/** "More adorable picks" — same category first, topped up with near-matches. */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = PRODUCTS.filter(
    (candidate) =>
      candidate.id !== product.id && candidate.category === product.category,
  );

  const sameGender = PRODUCTS.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.category !== product.category &&
      candidate.gender === product.gender,
  );

  const rest = PRODUCTS.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.category !== product.category &&
      candidate.gender !== product.gender,
  );

  return [...sameCategory, ...sameGender, ...rest].slice(0, limit);
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

export const MOCK_REVIEWS: readonly Review[] = [
  {
    id: "review-1",
    author: "Sarah M.",
    location: "Portland, OR",
    rating: 5,
    title: "My daughter loves this dress!",
    body: "She puts it on the second it comes out of the wash. The cotton is genuinely soft and the print has not faded after a summer of wear.",
    date: "2 weeks ago",
    verified: true,
  },
  {
    id: "review-2",
    author: "James R.",
    location: "Austin, TX",
    rating: 4,
    title: "Great quality, survived 50+ washes",
    body: "Bought two in different colours. Sizing runs slightly generous, which I prefer — room to grow without looking baggy.",
    date: "1 month ago",
    verified: true,
  },
  {
    id: "review-3",
    author: "Priya K.",
    location: "Seattle, WA",
    rating: 5,
    title: "Perfect for my son's birthday party",
    body: "Comfortable enough that he forgot he was dressed up, and it still looked lovely in every photo. Would happily buy again.",
    date: "1 month ago",
    verified: true,
  },
] as const;

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
  { emoji: "🚚", label: "Free Shipping over $50" },
  { emoji: "🔄", label: "30-Day Easy Returns" },
  { emoji: "🌿", label: "Kid-Safe Materials" },
  { emoji: "✅", label: "Quality Guaranteed" },
] as const;
