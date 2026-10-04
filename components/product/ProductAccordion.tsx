"use client";

import { Gift, Leaf, RotateCcw, Sparkles, Truck } from "lucide-react";
import { CARE_INSTRUCTIONS, SIZE_CHART } from "@/lib/site";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Product } from "@/types";

interface ProductAccordionProps {
  product: Product;
}

/**
 * Long-form product information. Radix accordion (shadcn) so keyboard
 * navigation and ARIA wiring come for free.
 */
export function ProductAccordion({ product }: ProductAccordionProps) {
  const isOrganic = product.material.toLowerCase().includes("organic");

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="details"
      className="glass-soft rounded-3xl border border-glass-border px-5"
    >
      <AccordionItem value="details" className="border-glass-border">
        <AccordionTrigger className="py-5 text-sm font-semibold tracking-wide hover:text-primary hover:no-underline">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Product Details
          </span>
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          <p className="prose-kids">{product.description}</p>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] tracking-[0.16em] uppercase">Material</dt>
              <dd className="text-foreground/85">{product.material}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.16em] uppercase">Sizes</dt>
              <dd className="text-foreground/85">{product.sizes.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.16em] uppercase">Care</dt>
              <dd className="text-foreground/85">{CARE_INSTRUCTIONS}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.16em] uppercase">Age</dt>
              <dd className="text-foreground/85">
                Recommended for ages {product.ageRange.replace("Y", " years")}
              </dd>
            </div>
          </dl>
          {isOrganic && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs text-emerald-400">
              <Leaf className="size-3.5" />
              GOTS-certified organic fibres, OEKO-TEX tested for kid-safe dyes
            </p>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="size" className="border-glass-border">
        <AccordionTrigger className="py-5 text-sm font-semibold tracking-wide hover:text-primary hover:no-underline">
          <span className="flex items-center gap-2">
            <Truck className="size-4 text-lavender" />
            Size Guide
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Size chart with age and height</caption>
              <thead>
                <tr className="border-b border-glass-border text-left text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  <th scope="col" className="py-2.5 pr-4 font-medium">Size</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">Age</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">Height</th>
                  <th scope="col" className="py-2.5 font-medium">Chest</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART.filter((row) => product.sizes.includes(row.size)).map(
                  (row) => (
                    <tr key={row.size} className="border-b border-glass-border/60 last:border-0">
                      <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-primary">
                        {row.size}
                      </th>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.age}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.height}</td>
                      <td className="py-2.5 text-muted-foreground">{row.chest}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Not sure? Order two sizes — returns are free for 30 days.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="shipping" className="border-glass-border">
        <AccordionTrigger className="py-5 text-sm font-semibold tracking-wide hover:text-primary hover:no-underline">
          <span className="flex items-center gap-2">
            <Gift className="size-4 text-rose" />
            Shipping Info
          </span>
        </AccordionTrigger>
        <AccordionContent className="prose-kids text-sm text-muted-foreground">
          Free shipping on orders over $50, otherwise a flat $4.95. Orders are
          dispatched within one business day and arrive in 3–5 business days. Gift
          wrapping available 🎁
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="returns" className="border-glass-border-0 border-0">
        <AccordionTrigger className="py-5 text-sm font-semibold tracking-wide hover:text-primary hover:no-underline">
          <span className="flex items-center gap-2">
            <RotateCcw className="size-4 text-emerald-400" />
            Returns & Exchanges
          </span>
        </AccordionTrigger>
        <AccordionContent className="prose-kids text-sm text-muted-foreground">
          30-day hassle-free returns with free return shipping. If a piece does not
          fit, we will exchange it for another size at no extra cost.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
