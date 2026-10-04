"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { countProductsInCategory } from "@/lib/mock-admin";
import { CategoryDialog } from "@/components/admin/CategoryDialog";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { adminButtonBlue } from "@/components/admin/Field";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCategory } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AdminCategoriesPage() {
  const categories = useAdminStore((state) => state.categories);
  const products = useAdminStore((state) => state.products);
  const deleteCategory = useAdminStore((state) => state.deleteCategory);
  const setSearch = useAdminStore((state) => state.setSearch);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCategory | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {categories.length} categories · {products.length} products grouped
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Cards link straight into the product table via the console search.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={cn(adminButtonBlue, "min-h-10")}>
          <Plus aria-hidden className="size-4" />
          New Category
        </button>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {categories.map((category, index) => {
            const count = countProductsInCategory(products, category.name);
            return (
              <motion.li
                key={category.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.35, delay: index * 0.04, ease: EASE }}
                className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-5 transition-colors duration-200 hover:border-blue-500/30"
              >
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#2A2A2A] bg-[#101010] text-xl"
                  >
                    {category.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {category.name}
                    </h2>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      /{category.slug}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/12 px-2 py-0.5 text-[11px] font-medium text-blue-300 tabular-nums">
                    {count} products
                  </span>
                </header>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {category.description}
                </p>

                {category.parent && (
                  <p className="text-[11px] text-muted-foreground">
                    Parent: <span className="text-foreground">{category.parent}</span>
                  </p>
                )}

                <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#242424] pt-3">
                  <Link
                    href="/admin/products"
                    onClick={() => setSearch(category.name)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 text-xs text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                  >
                    View products
                    <ArrowUpRight aria-hidden className="size-3.5" />
                  </Link>

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                    >
                      <Pencil aria-hidden className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(category)}
                      aria-label={`Delete ${category.name}`}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-rose-500/50 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  </div>
                </footer>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        parents={categories}
      />

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this category?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will disappear from the console. Products keep their category name until reassigned.`
            : undefined
        }
        confirmLabel="Delete category"
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteCategory(pendingDelete.id);
          toast.success(`${pendingDelete.name} deleted 🗑️`);
        }}
      />
    </div>
  );
}
