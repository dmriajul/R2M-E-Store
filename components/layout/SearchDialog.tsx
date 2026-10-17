"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiResponse, Product } from "@/types";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Command-palette style search.
 *
 * The catalogue is fetched once from `/api/products` (the live database) when
 * the dialog opens and filtered client-side, so typing stays instant. An empty
 * catalogue renders an honest empty state.
 */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<Product[]>;
        if (!active) return;
        if (!response.ok || !result.success || !result.data) throw new Error("search unavailable");
        setCatalogue(result.data);
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return catalogue.slice(0, 3);

    return catalogue
      .filter((product) =>
        [product.name, product.tagline, product.category, ...product.tags]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 5);
  }, [catalogue, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 translate-y-0 gap-0 overflow-hidden border-glass-border bg-black/85 p-0 backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Search products</DialogTitle>
          <DialogDescription>
            Find pieces in the collection by name or category.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-glass-border px-4">
          <Search className="size-4 shrink-0 text-primary" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the collection…"
            aria-label="Search products"
            className="h-14 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <kbd className="hidden shrink-0 rounded border border-glass-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {failed ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Search is unavailable right now. Please try again in a moment.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {catalogue.length === 0
                ? "The collection is being restocked — check back soon."
                : `No pieces match “${query}”.`}
            </p>
          ) : (
            <ul>
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/product/${product.id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors duration-300 hover:bg-glass"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {product.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.tagline}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {formatPrice(product.price, product.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
