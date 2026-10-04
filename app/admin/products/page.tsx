"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PRODUCT_CATEGORY_NAMES } from "@/lib/validations";
import { PRODUCTS } from "@/lib/site";
import { getStockState } from "@/lib/mock-admin";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { StockBadge } from "@/components/admin/StatusBadge";
import { ProductForm } from "@/components/admin/ProductForm";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import {
  adminButtonBlue,
  adminButtonGhost,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminProduct, ProductCategory, StockState } from "@/types";

type StatusFilter = "all" | StockState;
type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "newest";

const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in-stock", label: "In Stock" },
  { id: "low-stock", label: "Low Stock" },
  { id: "out-of-stock", label: "Out of Stock" },
];

const SORTS: readonly { id: SortKey; label: string }[] = [
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "stock-asc", label: "Stock: lowest first" },
  { id: "newest", label: "Newest first" },
];

function categoryFilterOf(query: string): ProductCategory | "all" {
  return PRODUCT_CATEGORY_NAMES.includes(query as ProductCategory)
    ? (query as ProductCategory)
    : "all";
}

export default function AdminProductsPage() {
  const products = useAdminStore((state) => state.products);
  const deleteProducts = useAdminStore((state) => state.deleteProducts);
  const duplicateProduct = useAdminStore((state) => state.duplicateProduct);
  const setProductsOutOfStock = useAdminStore((state) => state.setProductsOutOfStock);
  /* Handoff from the top-bar search and the category cards (e.g. "Dresses"). */
  const seed = useAdminStore((state) => state.search);
  const clearSeed = useAdminStore((state) => state.setSearch);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesTerm =
        term.length === 0 ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term);
      const matchesCategory = category === "all" || product.category === category;
      const matchesStatus =
        status === "all" || getStockState(product.stock, product.lowStockThreshold) === status;
      return matchesTerm && matchesCategory && matchesStatus;
    });
  }, [products, search, category, status]);

  const initialSort = useMemo(() => {
    switch (sort) {
      case "name-desc":
        return { key: "name", direction: "desc" as const };
      case "price-asc":
        return { key: "price", direction: "asc" as const };
      case "price-desc":
        return { key: "price", direction: "desc" as const };
      case "stock-asc":
        return { key: "stock", direction: "asc" as const };
      case "newest":
        return { key: "created", direction: "desc" as const };
      default:
        return { key: "name", direction: "asc" as const };
    }
  }, [sort]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => products.some((product) => product.id === id)));
  }, [products]);

  /* Apply the one-shot handoff, then clear it so other pages start fresh. */
  useEffect(() => {
    if (!seed) return;
    const asCategory = categoryFilterOf(seed);
    if (asCategory !== "all") {
      setCategory(asCategory);
      setSearch("");
    } else {
      setSearch(seed);
    }
    clearSeed("");
  }, [seed, clearSeed]);

  const clearSelection = () => setSelected([]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (product: AdminProduct) => {
    setEditing(product);
    setFormOpen(true);
  };

  const handleDuplicate = (product: AdminProduct) => {
    const id = duplicateProduct(product.id);
    toast.success("Product duplicated 📄", { description: `Created ${id}.` });
  };

  const handleDelete = (product: AdminProduct) => {
    deleteProducts([product.id]);
    toast.success("Product deleted 🗑️", { description: `${product.name} removed from the catalogue.` });
  };

  const handleBulkDelete = () => {
    const count = selected.length;
    deleteProducts(selected);
    clearSelection();
    toast.success(`${count} products deleted 🗑️`);
  };

  const handleBulkOutOfStock = () => {
    const count = selected.length;
    setProductsOutOfStock(selected);
    clearSelection();
    toast.success(`${count} products set to out of stock`);
  };

  const columns: readonly DataTableColumn<AdminProduct>[] = [
    {
      key: "image",
      label: "Image",
      className: "w-16",
      render: (product) => (
        <ProductArtwork product={product} size="thumb" className="size-11 rounded-lg" />
      ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      sortValue: (product) => product.name,
      render: (product) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{product.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{product.sku}</p>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (product) => <span className="text-muted-foreground">{product.category}</span>,
    },
    {
      key: "age",
      label: "Age Range",
      align: "center",
      render: (product) => (
        <span className="text-muted-foreground tabular-nums">{product.ageRange}</span>
      ),
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      sortable: true,
      sortValue: (product) => product.price,
      render: (product) => (
        <span className="font-medium text-foreground tabular-nums">
          ${product.price.toFixed(2)}
        </span>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      align: "right",
      sortable: true,
      sortValue: (product) => product.stock,
      render: (product) => (
        <span className="block text-right">
          <span className="block text-foreground tabular-nums">{product.stock}</span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            threshold {product.lowStockThreshold}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (product) => (
        <span className="flex flex-col items-start gap-1">
          <StockBadge state={getStockState(product.stock, product.lowStockThreshold)} />
          {product.status !== "active" && (
            <span className="text-[11px] text-muted-foreground">Draft</span>
          )}
        </span>
      ),
    },
    {
      key: "created",
      label: "Newest",
      sortable: true,
      sortValue: (product) => product.createdAt,
      className: "hidden xl:table-cell",
      render: (product) => (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {product.createdAt.slice(0, 10)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      className: "w-32",
      render: (product) => (
        <span
          className="inline-flex items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <IconAction
            label={`Edit ${product.name}`}
            icon={<Pencil aria-hidden className="size-3.5" />}
            onClick={() => openEdit(product)}
          />
          <IconAction
            label={`Duplicate ${product.name}`}
            icon={<Copy aria-hidden className="size-3.5" />}
            onClick={() => handleDuplicate(product)}
          />
          <IconAction
            label={`Delete ${product.name}`}
            icon={<Trash2 aria-hidden className="size-3.5" />}
            destructive
            onClick={() => setPendingDelete(product)}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Toolbar ---------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or SKU..."
              className={adminInputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="product-category-filter" className="sr-only">
              Filter by category
            </label>
            <select
              id="product-category-filter"
              value={category}
              onChange={(event) => setCategory(event.target.value as ProductCategory | "all")}
              className={cn(adminSelectClass, "w-auto min-w-36")}
            >
              <option value="all">All categories</option>
              {PRODUCT_CATEGORY_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <label htmlFor="product-sort" className="sr-only">
              Sort products
            </label>
            <select
              id="product-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={cn(adminSelectClass, "w-auto min-w-40")}
            >
              {SORTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>

            <button type="button" onClick={openCreate} className={cn(adminButtonBlue, "min-h-10")}>
              <Plus aria-hidden className="size-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((entry) => {
            const active = status === entry.id;
            const count =
              entry.id === "all"
                ? products.length
                : products.filter(
                    (product) =>
                      getStockState(product.stock, product.lowStockThreshold) === entry.id,
                  ).length;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setStatus(entry.id)}
                aria-pressed={active}
                className={cn(
                  "min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                  active
                    ? "border-blue-500/50 bg-blue-500/12 text-blue-300"
                    : "border-[#2A2A2A] text-muted-foreground hover:border-[#3A3A3A] hover:text-foreground",
                )}
              >
                {entry.label}
                <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}

          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Download aria-hidden className="size-3.5" />
            {rows.length} shown · {PRODUCTS.length} in the catalogue
          </span>
        </div>
      </section>

      {/* ---------- Bulk bar ---------- */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/35 bg-blue-500/8 px-4 py-3">
          <p className="text-xs font-medium text-foreground tabular-nums">
            {selected.length} selected
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkOutOfStock}
              className={cn(adminButtonGhost, "min-h-9 px-3")}
            >
              Set Out of Stock
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className={cn(adminButtonBlue, "min-h-9 bg-rose-500 px-3 text-white hover:bg-rose-400")}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Delete Selected
            </button>
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------- Table ---------- */}
      <DataTable
        key={`${sort}-${category}-${status}`}
        rows={rows}
        columns={columns}
        rowKey={(product) => product.id}
        initialSort={initialSort}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={openEdit}
        emptyMessage="No products match these filters."
      />

      <ProductForm open={formOpen} onOpenChange={setFormOpen} product={editing} />

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this product?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will be removed from the catalogue. This can't be undone in the demo.`
            : undefined
        }
        confirmLabel="Delete product"
        destructive
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />

      <ConfirmActionDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.length} products?`}
        description="Selected products are removed from the local catalogue."
        confirmLabel="Delete selected"
        destructive
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}

function IconAction({
  label,
  icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
        destructive
          ? "hover:border-rose-500/50 hover:text-rose-400"
          : "hover:border-[#3A3A3A] hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
