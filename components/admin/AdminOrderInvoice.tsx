import { formatPrice, formatShortDate } from "@/lib/utils";
import Image from "next/image";
import type { AdminOrder } from "@/types";

export function AdminOrderInvoice({ order }: { order: AdminOrder }) {
  return (
    <article
      id="print-invoice"
      className="hidden bg-white p-8 text-black print:block"
      aria-label={`Invoice ${order.number}`}
    >
      <header className="flex items-start justify-between gap-6 border-b border-black/15 pb-5">
        <div>
          <Image
            src="/icons/logo.png"
            alt="MUKRA"
            width={406}
            height={190}
            priority
            className="h-12 w-auto object-contain"
          />
          <p className="mt-1 text-xs text-black/60">
            Adorable styles for your little ones
          </p>
        </div>
        <div className="text-right text-sm">
          <h1 className="text-xl font-semibold">Invoice</h1>
          <p className="mt-1">Order {order.number}</p>
          <p>Placed {formatShortDate(order.placedAt)}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-8 text-sm">
        <div>
          <h2 className="font-semibold uppercase tracking-wide">Customer</h2>
          <p className="mt-2 font-medium">{order.customer.name}</p>
          <p>{order.customer.email}</p>
          <p>{order.customer.phone}</p>
        </div>
        <div>
          <h2 className="font-semibold uppercase tracking-wide">Ship to</h2>
          <p className="mt-2 font-medium">{order.shipping.fullName}</p>
          <p>{order.shipping.line1}</p>
          {order.shipping.line2 && <p>{order.shipping.line2}</p>}
          <p>
            {order.shipping.city}
            {order.shipping.state ? `, ${order.shipping.state}` : ""}{" "}
            {order.shipping.postalCode}
          </p>
          <p>{order.shipping.country}</p>
        </div>
      </section>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black/20 text-left">
            <th className="py-2 font-semibold">Product</th>
            <th className="py-2 font-semibold">Variant</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Unit price</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.lineId} className="border-b border-black/10">
              <td className="py-2 pr-3">{item.name}</td>
              <td className="py-2 pr-3">
                {item.color} · {item.size}
              </td>
              <td className="py-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">
                {formatPrice(item.price)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatPrice(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ml-auto mt-5 w-full max-w-xs text-sm">
        <div className="flex justify-between py-1">
          <span>Subtotal</span>
          <span>{formatPrice(order.totals.subtotal)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Shipping</span>
          <span>{formatPrice(order.totals.shipping)}</span>
        </div>
        {order.totals.giftWrap > 0 && (
          <div className="flex justify-between py-1">
            <span>Gift wrap</span>
            <span>{formatPrice(order.totals.giftWrap)}</span>
          </div>
        )}
        {order.totals.discount > 0 && (
          <div className="flex justify-between py-1">
            <span>Discount</span>
            <span>−{formatPrice(order.totals.discount)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-black/20 pt-2 text-base font-bold">
          <span>Total (BDT)</span>
          <span>{formatPrice(order.totals.total)}</span>
        </div>
      </section>

      <footer className="mt-10 border-t border-black/15 pt-4 text-sm text-black/70">
        Thank you for shopping with MUKRA.
      </footer>
    </article>
  );
}
