import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = {
  title: { absolute: "Checkout | LITTLE LUXE" },
  description:
    "Secure checkout for LITTLE LUXE kids fashion — card, bKash, Nagad or SSLCommerz. Free shipping over $50.",
  // Transactional screen: keep it out of search results.
  robots: { index: false, follow: false },
};

/**
 * Checkout route. The page is a thin server component so it can own metadata
 * and robots directives; all of the interactivity lives in <CheckoutFlow />.
 */
export default function CheckoutPage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(80%_100%_at_50%_0%,rgba(212,175,55,0.10)_0%,transparent_60%),radial-gradient(60%_80%_at_85%_10%,rgba(167,139,250,0.08)_0%,transparent_65%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <header className="mb-10">
          <p className="text-xs font-semibold tracking-[0.3em] text-lavender uppercase">
            Secure checkout
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Almost there 🧸
          </h1>
          <span
            aria-hidden
            className="mt-5 block h-1 w-24 rounded-full bg-linear-to-r from-primary via-rose to-lavender"
          />
        </header>

        <CheckoutFlow />
      </div>
    </div>
  );
}
