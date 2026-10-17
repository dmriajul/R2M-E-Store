"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/store/useCartStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const [ready, setReady] = useState(false);
  const { items, total, updateQuantity, removeItem } = useCartStore();
  useEffect(() => setReady(true), []);
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold">Your bag</h1>
      {!ready ? (
        <p className="mt-6" role="status">
          Loading your bag…
        </p>
      ) : !items.length ? (
        <p className="mt-6 text-muted-foreground">
          Your bag is empty.{" "}
          <Link href="/shop" className="text-primary underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-glass-border">
            {items.map((item) => (
              <li
                key={item.lineId}
                className="flex flex-wrap items-center justify-between gap-4 py-6"
              >
                <div>
                  <Link
                    href={`/product/${item.productId}`}
                    className="font-semibold hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.color} · {item.size} · {formatPrice(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    aria-label={`Decrease quantity of ${item.name}`}
                    onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                  >
                    −
                  </Button>
                  <span aria-live="polite">{item.quantity}</span>
                  <Button
                    variant="outline"
                    aria-label={`Increase quantity of ${item.name}`}
                    onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  >
                    +
                  </Button>
                  <Button variant="ghost" onClick={() => removeItem(item.lineId)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xl font-semibold">Subtotal: {formatPrice(total)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Delivery and discounts calculated at checkout.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
        </>
      )}
    </section>
  );
}
