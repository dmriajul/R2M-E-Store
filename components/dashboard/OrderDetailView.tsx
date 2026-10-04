"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, ExternalLink, MessageCircle, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";
import { returnRequestSchema, RETURN_REASONS, type ReturnRequestValues } from "@/lib/validations";
import { isTrackable } from "@/lib/mock-dashboard";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { OrderStatusBadge } from "@/components/dashboard/OrderStatusBadge";
import { OrderThumb } from "@/components/dashboard/OrderCard";
import { OrderTimeline } from "@/components/dashboard/OrderTimeline";
import { InvoiceDocument } from "@/components/dashboard/InvoiceDocument";
import { useReorder } from "@/components/dashboard/useReorder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkoutInputClass, Field } from "@/components/checkout/Field";
import type { DashboardOrder } from "@/types";

const DHL_TRACKING_URL = "https://www.dhl.com/bd-en/home/tracking.html";

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass-soft flex flex-col gap-4 rounded-3xl border border-glass-border p-5",
        className,
      )}
    >
      <h2 className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TotalsLine({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={cn("text-muted-foreground", emphasis && "font-medium text-foreground")}>
        {label}
      </span>
      <span className={cn("tabular-nums", emphasis ? "text-base font-bold text-primary" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

/** Full order view: tracker, shipping, item table, payment, returns and invoice. */
export function OrderDetailView({ order }: { order: DashboardOrder }) {
  const reorder = useReorder();
  const [returnOpen, setReturnOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReturnRequestValues>({
    resolver: zodResolver(returnRequestSchema),
    defaultValues: { reason: "Wrong size", note: "" },
  });

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(order.shipping.trackingNumber);
      toast.success("Tracking number copied 📋", {
        description: "Paste it anywhere to follow the parcel.",
      });
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
    }
  };

  const onSubmitReturn = (values: ReturnRequestValues) => {
    reset();
    setReturnOpen(false);
    toast.success("Return request sent 📦", {
      description: `We'll email a label within 24 hours. Reason: ${values.reason}.`,
    });
  };

  return (
    <>
      <div className="print:hidden">
        <Link
          href="/dashboard/orders"
          className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          All orders
        </Link>

        <DashboardPageHeader
          title={`Order ${order.number}`}
          description={`Placed ${formatShortDate(order.placedAt)} · ${order.deliveryNote}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} className="h-10 px-4 text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                className="h-10 rounded-full border-glass-border bg-glass px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary"
              >
                <Printer className="size-3.5" />
                Print Invoice
              </Button>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ---------- Left: tracker + items ---------- */}
          <div className="flex flex-col gap-6">
            <Panel title="Tracking">
              {isTrackable(order.status) && (
                <p className="text-xs text-muted-foreground">
                  {order.shipping.carrier} · on the way to {order.shipping.address.city} 🚚
                </p>
              )}
              <OrderTimeline steps={order.timeline} />
            </Panel>

            <Panel title={`Items (${order.items.length})`}>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                      <th className="px-2 py-2 font-semibold">Item</th>
                      <th className="hidden px-2 py-2 font-semibold sm:table-cell">Variant</th>
                      <th className="px-2 py-2 text-center font-semibold">Qty</th>
                      <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">
                        Price
                      </th>
                      <th className="px-2 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr
                        key={item.lineId}
                        className="border-t border-glass-border/70 transition-colors duration-300 even:bg-white/2 hover:bg-white/5"
                      >
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            <OrderThumb item={item} className="size-11" />
                            <div className="min-w-0">
                              <Link
                                href={`/product/${item.productId}`}
                                className="block truncate font-medium text-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              >
                                {item.name}
                              </Link>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                {item.color} · {item.size}
                              </span>
                              <span className="hidden text-xs text-muted-foreground sm:block">
                                Ages {item.ageRange}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-2 py-3 text-muted-foreground sm:table-cell">
                          {item.color} · {item.size}
                        </td>
                        <td className="px-2 py-3 text-center tabular-nums">{item.quantity}</td>
                        <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">
                          {formatPrice(item.price)}
                        </td>
                        <td className="px-2 py-3 text-right font-medium tabular-nums">
                          {formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-glass-border bg-white/3 p-4">
                <TotalsLine label="Subtotal" value={formatPrice(order.totals.subtotal)} />
                <TotalsLine
                  label="Shipping"
                  value={order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}
                />
                {order.totals.giftWrap > 0 && (
                  <TotalsLine label="Gift wrap" value={formatPrice(order.totals.giftWrap)} />
                )}
                {order.totals.discount > 0 && (
                  <TotalsLine label="Discount" value={`−${formatPrice(order.totals.discount)}`} />
                )}
                <div className="mt-1 border-t border-glass-border pt-2">
                  <TotalsLine label="Total" value={formatPrice(order.totals.total)} emphasis />
                </div>
              </div>
            </Panel>
          </div>

          {/* ---------- Right: shipping, payment, actions ---------- */}
          <div className="flex flex-col gap-6">
            <Panel title="Shipping To">
              <div className="text-sm">
                <p className="font-medium text-foreground">{order.shipping.fullName}</p>
                <p className="text-muted-foreground">{order.shipping.address.line1}</p>
                {order.shipping.address.line2 && (
                  <p className="text-muted-foreground">{order.shipping.address.line2}</p>
                )}
                <p className="text-muted-foreground">
                  {order.shipping.address.city} {order.shipping.address.postalCode},{" "}
                  {order.shipping.address.country}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {order.shipping.address.phone}
                </p>
              </div>

              <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-glass-border bg-white/3 p-3">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  {order.shipping.carrier}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-xs text-foreground">
                    {order.shipping.trackingNumber}
                  </code>
                  <button
                    type="button"
                    onClick={copyTracking}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass text-muted-foreground transition-colors duration-300 hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label="Copy tracking number"
                  >
                    <Copy aria-hidden className="size-3.5" />
                  </button>
                </div>
                <a
                  href={DHL_TRACKING_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors duration-300 hover:text-gold-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Track on DHL
                  <ExternalLink aria-hidden className="size-3" />
                </a>
              </div>
            </Panel>

            <Panel title="Payment">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-foreground">{order.payment.label}</span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    order.payment.status === "paid"
                      ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-300"
                      : "border-amber-400/30 bg-amber-400/12 text-amber-300",
                  )}
                >
                  {order.payment.status === "paid" ? "Paid ✅" : "Refunded 💸"}
                </span>
              </div>
            </Panel>

            <Panel title="Need anything?">
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => reorder(order)}
                  className="h-12 w-full rounded-full bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_32px_-8px_rgba(212,175,55,0.9)]"
                >
                  <RotateCcw className="size-4" />
                  Reorder All
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={order.status === "cancelled"}
                  onClick={() => setReturnOpen(true)}
                  className="h-12 w-full rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-rose/40 hover:text-rose disabled:opacity-40"
                >
                  Request Return
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    toast.info("Our team is on it 💬", {
                      description: `We'll reply about ${order.number} within 24 hours.`,
                    })
                  }
                  className="h-12 w-full rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-cyan/40 hover:text-cyan"
                >
                  <MessageCircle className="size-4" />
                  Contact Support
                </Button>
              </div>
            </Panel>
          </div>
        </div>

        {/* ---------- Return request ---------- */}
        <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
          <DialogContent className="glass-strong max-w-md rounded-3xl border-glass-border">
            <DialogHeader>
              <DialogTitle className="text-lg">Request a return 📦</DialogTitle>
              <DialogDescription className="prose-kids">
                Tell us what happened and we&apos;ll email a prepaid label within 24 hours.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmitReturn)} className="flex flex-col gap-4">
              <Field label="Reason" htmlFor="return-reason" error={errors.reason?.message}>
                <select
                  id="return-reason"
                  className={cn(checkoutInputClass, "w-full px-3")}
                  aria-invalid={Boolean(errors.reason)}
                  {...register("reason")}
                >
                  {RETURN_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Anything else? (optional)"
                htmlFor="return-note"
                error={errors.note?.message}
                hint="Sizes, fit, photos — anything that helps us help you."
              >
                <textarea
                  id="return-note"
                  rows={3}
                  placeholder="The 4T runs a little small…"
                  className={cn(checkoutInputClass, "min-h-24 py-3")}
                  aria-invalid={Boolean(errors.note)}
                  {...register("note")}
                />
              </Field>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReturnOpen(false)}
                  className="h-11 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.14em] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 rounded-full bg-primary text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.9)]"
                >
                  Send Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <InvoiceDocument order={order} />
    </>
  );
}
