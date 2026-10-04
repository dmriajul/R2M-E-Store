import { formatPrice, formatShortDate } from "@/lib/utils";
import { ORDER_STATUS_META } from "@/lib/mock-dashboard";
import type { DashboardOrder } from "@/types";

/**
 * Printable invoice.
 *
 * Hidden on screen (`hidden print:block`) and revealed by the `@media print`
 * rules in `app/globals.css`, which also hide the storefront chrome. Deliberately
 * light-on-white with hard borders, since it is a document, not a shelf.
 */
export function InvoiceDocument({ order }: { order: DashboardOrder }) {
  const address = order.shipping.address;

  return (
    <article id="print-invoice" className="hidden bg-white text-black print:block">
      <header className="flex items-start justify-between gap-6 border-b border-black/15 pb-4">
        <div>
          <p className="text-lg font-bold tracking-[0.34em]">LITTLE LUXE</p>
          <p className="mt-1 text-xs text-black/60">Adorable styles for your little ones</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-base font-semibold">Invoice</p>
          <p className="mt-1">Order {order.number}</p>
          <p>Placed {formatShortDate(order.placedAt)}</p>
          <p className="mt-1 font-medium">{ORDER_STATUS_META[order.status].label}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-xs">
        <div>
          <p className="font-semibold tracking-[0.16em] uppercase">Shipping to</p>
          <p className="mt-2 font-medium">{order.shipping.fullName}</p>
          <p>{address.line1}</p>
          {address.line2 && <p>{address.line2}</p>}
          <p>
            {address.city} {address.postalCode}
          </p>
          <p>{address.country}</p>
          <p className="mt-1">{address.phone}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tracking-[0.16em] uppercase">Payment</p>
          <p className="mt-2">{order.payment.label}</p>
          <p>{order.payment.status === "paid" ? "Paid" : "Refunded"}</p>
          <p className="mt-3 font-semibold tracking-[0.16em] uppercase">Carrier</p>
          <p className="mt-1">{order.shipping.carrier}</p>
          <p>{order.shipping.trackingNumber}</p>
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-black/15 text-left">
            <th className="py-2 font-semibold">Item</th>
            <th className="py-2 font-semibold">Variant</th>
            <th className="py-2 text-center font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Unit</th>
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
              <td className="py-2 text-center tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">{formatPrice(item.price)}</td>
              <td className="py-2 text-right tabular-nums">
                {formatPrice(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 ml-auto w-full max-w-xs text-xs">
        <div className="flex justify-between py-1">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(order.totals.subtotal)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Shipping</span>
          <span className="tabular-nums">
            {order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}
          </span>
        </div>
        {order.totals.giftWrap > 0 && (
          <div className="flex justify-between py-1">
            <span>Gift wrap</span>
            <span className="tabular-nums">{formatPrice(order.totals.giftWrap)}</span>
          </div>
        )}
        {order.totals.discount > 0 && (
          <div className="flex justify-between py-1">
            <span>Discount</span>
            <span className="tabular-nums">−{formatPrice(order.totals.discount)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-black/20 pt-2 text-sm font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(order.totals.total)}</span>
        </div>
      </section>

      <footer className="mt-8 border-t border-black/15 pt-4 text-xs text-black/70">
        <p>Thank you for shopping at Little Luxe! 🧸</p>
        <p className="mt-1">
          Questions? Reply to your confirmation email or write to hello@littleluxe.example.com —
          we answer within 24 hours.
        </p>
      </footer>
    </article>
  );
}
