import type { AgeFilter } from "@/types";
import {
  ageFilters,
  categories,
  categoryFromSlug,
  categoryToSlug,
  genderFilters,
  sortOptions,
  type CategoryFilter,
  type GenderFilterValue,
  type SortValue,
} from "@/lib/site";

/** Everything the shop page filters by. Mirrored into the URL query string. */
export interface ShopFilterState {
  category: CategoryFilter;
  age: AgeFilter;
  gender: GenderFilterValue;
  sort: SortValue;
  view: "grid" | "list";
}

export const DEFAULT_SHOP_FILTERS: ShopFilterState = {
  category: "All",
  age: "All Ages",
  gender: "all",
  sort: "featured",
  view: "grid",
} as const;

/** Cards revealed per "Load more" step. */
export const SHOP_PAGE_SIZE = 8;

function isCategory(value: string): value is CategoryFilter {
  return (categories as readonly string[]).includes(value);
}

function isAge(value: string): value is AgeFilter {
  return (ageFilters as readonly string[]).includes(value);
}

function isGender(value: string): value is GenderFilterValue {
  return genderFilters.some((option) => option.value === value);
}

function isSort(value: string): value is SortValue {
  return sortOptions.some((option) => option.value === value);
}

/**
 * Read filters out of a Next.js `searchParams` object, ignoring anything
 * unrecognised so a hand-edited URL can never break the page.
 */
export function filtersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): ShopFilterState {
  const read = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const categorySlug = read("category");
  const category = categorySlug ? categoryFromSlug(categorySlug) : "All";
  const age = read("age");
  const gender = read("gender");
  const sort = read("sort");
  const view = read("view");

  return {
    category: isCategory(category) ? category : "All",
    age: age && isAge(age) ? age : "All Ages",
    gender: gender && isGender(gender) ? gender : "all",
    sort: sort && isSort(sort) ? sort : "featured",
    view: view === "list" ? "list" : "grid",
  };
}

/** Serialise filters for the address bar — omits values that are default. */
export function filtersToSearchParams(filters: ShopFilterState): string {
  const params = new URLSearchParams();

  if (filters.category !== "All") {
    params.set("category", categoryToSlug(filters.category));
  }
  if (filters.age !== "All Ages") {
    params.set("age", filters.age);
  }
  if (filters.gender !== "all") {
    params.set("gender", filters.gender);
  }
  if (filters.sort !== "featured") {
    params.set("sort", filters.sort);
  }
  if (filters.view !== "grid") {
    params.set("view", filters.view);
  }

  return params.toString();
}

/** Used by the mobile "Filters" button badge. */
export function countActiveFilters(filters: ShopFilterState): number {
  let count = 0;
  if (filters.category !== "All") count += 1;
  if (filters.age !== "All Ages") count += 1;
  if (filters.gender !== "all") count += 1;
  return count;
}

export function hasActiveFilters(filters: ShopFilterState): boolean {
  return countActiveFilters(filters) > 0;
}
