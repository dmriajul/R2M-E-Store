"use client";

import { useId, useState } from "react";
import {
  ArrowDownWideNarrow,
  Check,
  LayoutGrid,
  List,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ageFilters,
  categories,
  genderFilters,
  sortOptions,
} from "@/lib/site";
import { countActiveFilters, type ShopFilterState } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface FilterControlsProps {
  filters: ShopFilterState;
  onChange: (patch: Partial<ShopFilterState>) => void;
  /** Prefixes control ids so the desktop bar and the mobile sheet stay unique. */
  idPrefix: string;
}

function Pill({
  active,
  children,
  onClick,
  size = "md",
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  size?: "md" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border font-medium whitespace-nowrap transition-all duration-400 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[0_0_24px_-8px_rgba(212,175,55,0.9)]"
          : "border-glass-border bg-glass text-muted-foreground hover:border-rose/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ControlGroup({
  label,
  children,
  id,
}: {
  label: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="flex flex-col gap-2.5">
      <span className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Shared control set — rendered inline on desktop and inside the sheet on mobile. */
function FilterControls({ filters, onChange, idPrefix }: FilterControlsProps) {
  return (
    <>
      <ControlGroup label="Category" id={`${idPrefix}-category`}>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Pill
              key={category}
              active={filters.category === category}
              onClick={() => onChange({ category })}
            >
              {category}
            </Pill>
          ))}
        </div>
      </ControlGroup>

      <ControlGroup label="Age" id={`${idPrefix}-age`}>
        <div className="flex flex-wrap gap-2">
          {ageFilters.map((age) => (
            <Pill
              key={age}
              size="sm"
              active={filters.age === age}
              onClick={() => onChange({ age })}
            >
              {age}
            </Pill>
          ))}
        </div>
      </ControlGroup>

      <ControlGroup label="Shop for" id={`${idPrefix}-gender`}>
        <div className="flex flex-wrap gap-2">
          {genderFilters.map((option) => (
            <Pill
              key={option.value}
              size="sm"
              active={filters.gender === option.value}
              onClick={() => onChange({ gender: option.value })}
            >
              <span aria-hidden className="mr-1.5">
                {option.emoji}
              </span>
              {option.label}
            </Pill>
          ))}
        </div>
      </ControlGroup>
    </>
  );
}

function SortMenu({
  filters,
  onChange,
}: {
  filters: ShopFilterState;
  onChange: (patch: Partial<ShopFilterState>) => void;
}) {
  // `useId` keeps the label wired to the trigger across both renders.
  const labelId = useId();
  const active = sortOptions.find((option) => option.value === filters.sort);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-labelledby={labelId}
          className="h-10 shrink-0 gap-2 rounded-full border-glass-border bg-glass px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase transition-colors duration-300 hover:border-rose/40 hover:text-foreground"
        >
          <ArrowDownWideNarrow className="size-3.5" />
          <span id={labelId} className="hidden sm:inline">
            {active?.label ?? "Sort"}
          </span>
          <span className="sm:hidden">Sort</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 border-glass-border bg-[#0d0d0d]/95 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Sort by
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-glass-border" />
        <DropdownMenuRadioGroup
          value={filters.sort}
          onValueChange={(value) =>
            onChange({ sort: value as ShopFilterState["sort"] })
          }
        >
          {sortOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="text-sm focus:bg-lavender-soft focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewToggle({
  filters,
  onChange,
}: {
  filters: ShopFilterState;
  onChange: (patch: Partial<ShopFilterState>) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex shrink-0 items-center gap-1 rounded-full border border-glass-border bg-glass p-1"
    >
      {(
        [
          { value: "grid", icon: LayoutGrid, label: "Grid view" },
          { value: "list", icon: List, label: "List view" },
        ] as const
      ).map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={filters.view === value}
          onClick={() => onChange({ view: value })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            filters.view === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

interface FilterBarProps {
  filters: ShopFilterState;
  onChange: (patch: Partial<ShopFilterState>) => void;
  /** "Showing X adorable items" */
  resultCount: number;
}

/**
 * Sticky control bar. On phones and tablets the filters collapse behind a
 * "Filters" button that opens a bottom sheet; from `lg` up the pills sit
 * inline under the navbar.
 */
export function FilterBar({ filters, onChange, resultCount }: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <div className="sticky top-16 z-40 border-y border-glass-border bg-black/65 backdrop-blur-xl backdrop-saturate-150 lg:top-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        {/* ---------- Mobile bar ---------- */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="h-10 gap-2 rounded-full border-glass-border bg-glass px-4 text-xs tracking-[0.12em] uppercase transition-colors duration-300 hover:border-rose/40"
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeCount > 0 && (
                  <Badge className="h-5 min-w-5 rounded-full border-0 bg-rose px-1.5 text-[10px] font-bold text-white">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl border-t border-glass-border bg-[#0c0c0c]/97 backdrop-blur-2xl"
            >
              <SheetHeader className="border-b border-glass-border px-6 py-5">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <span aria-hidden>🎨</span> Filters
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {resultCount} adorable {resultCount === 1 ? "item" : "items"} match
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-7 px-6 py-6">
                <FilterControls
                  filters={filters}
                  onChange={onChange}
                  idPrefix="mobile"
                />
              </div>

              <div className="sticky bottom-0 flex gap-3 border-t border-glass-border bg-[#0c0c0c]/95 px-6 py-4 backdrop-blur-xl">
                <Button
                  variant="outline"
                  onClick={() =>
                    onChange({
                      category: "All",
                      age: "All Ages",
                      gender: "all",
                    })
                  }
                  className="h-11 flex-1 rounded-full border-glass-border bg-glass text-xs tracking-[0.14em] uppercase"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => setSheetOpen(false)}
                  className="h-11 flex-1 rounded-full bg-primary text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase"
                >
                  Show {resultCount} items
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <SortMenu filters={filters} onChange={onChange} />
          <ViewToggle filters={filters} onChange={onChange} />

          <p
            aria-live="polite"
            className="ml-auto truncate text-xs text-muted-foreground"
          >
            <span className="text-rose">{resultCount}</span> items
          </p>
        </div>

        {/* ---------- Desktop bar ---------- */}
        <div className="hidden flex-col gap-4 lg:flex">
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((category) => (
                <Pill
                  key={category}
                  active={filters.category === category}
                  onClick={() => onChange({ category })}
                >
                  {category}
                </Pill>
              ))}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <SortMenu filters={filters} onChange={onChange} />
              <ViewToggle filters={filters} onChange={onChange} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-glass-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                Age
              </span>
              {ageFilters.map((age) => (
                <Pill
                  key={age}
                  size="sm"
                  active={filters.age === age}
                  onClick={() => onChange({ age })}
                >
                  {age}
                </Pill>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                Shop for
              </span>
              {genderFilters.map((option) => (
                <Pill
                  key={option.value}
                  size="sm"
                  active={filters.gender === option.value}
                  onClick={() => onChange({ gender: option.value })}
                >
                  <span aria-hidden className="mr-1.5">
                    {option.emoji}
                  </span>
                  {option.label}
                </Pill>
              ))}
            </div>

            <p aria-live="polite" className="ml-auto text-xs text-muted-foreground">
              Showing <span className="font-semibold text-rose">{resultCount}</span>{" "}
              adorable items
            </p>
          </div>
        </div>
      </div>

      {/* Active filter summary (mobile) — a quiet reminder of what is applied. */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 border-t border-glass-border px-4 py-2 lg:hidden">
          <Check className="size-3 text-rose" />
          <p className="truncate text-[11px] text-muted-foreground">
            {[
              filters.category !== "All" ? filters.category : null,
              filters.age !== "All Ages" ? filters.age : null,
              filters.gender !== "all"
                ? genderFilters.find((g) => g.value === filters.gender)?.label
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
