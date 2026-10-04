"use client";

import { AlertTriangle, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice } from "@/lib/utils";
import { getLowStockProducts } from "@/lib/mock-admin";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { adminButtonBlue } from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";

/** Restock shortcut — mock only, but it really does move the local numbers. */
const RESTOCK_UNITS = 25;

export function LowStockPanel({ className }: { className?: string }) {
  const products = useAdminStore((state) => state.products);
  const restockProduct = useAdminStore((state) => state.restockProduct);

  const low = getLowStockProducts(products);
  const outOfStock = products.filter(
    (product) => product.status === "active" && product.stock <= 0,
  );
  /* Urgent first: empty shelves, then the thinnest stock. */
  const alerts = [...outOfStock, ...low];

  const handleRestock = (id: string, name: string) => {
    restockProduct(id, RESTOCK_UNITS);
    toast.success(`Restocked ${name} with ${RESTOCK_UNITS} units ✅`);
  };

  return (
    <section
      className={cn(
        "rounded-xl border border-amber-500/25 bg-[#141414] p-5",
        className,
      )}
      aria-labelledby="low-stock-heading"
    >
      <header className="flex items-start gap-2.5">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div>
          <h2 id="low-stock-heading" className="text-sm font-semibold text-foreground">
            Low Stock Alert
          </h2>
          <p className="mt-1 text-xs text-amber-400/90">
            {low.length} products running low
            {outOfStock.length > 0 && ` · ${outOfStock.length} out of stock`}
          </p>
        </div>
      </header>

      {alerts.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Everything is comfortably stocked. 🎉
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {alerts.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[#242424] bg-[#101010] p-2.5"
            >
              <ProductArtwork
                product={product}
                size="thumb"
                className="size-11 shrink-0 rounded-lg"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{product.name}</p>
                <p
                  className={cn(
                    "mt-0.5 text-[11px] font-medium tabular-nums",
                    product.stock <= 5 ? "text-rose-400" : "text-amber-400",
                  )}
                >
                  {product.stock > 0 ? `Only ${product.stock} left!` : "Out of stock"}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {formatPrice(product.price)} · {product.sku}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRestock(product.id, product.name)}
                className={cn(adminButtonBlue, "min-h-9 w-full px-3 py-1.5 sm:w-auto")}
              >
                <PackagePlus aria-hidden className="size-3.5" />
                Restock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
