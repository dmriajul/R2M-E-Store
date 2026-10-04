"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, MapPin, Printer, Receipt, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatStamp } from "@/lib/utils";
import { ADMIN_ORDER_STATUS_LABEL, ADMIN_STATUSES } from "@/lib/mock-admin";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import {
  AdminField,
  adminButtonBlue,
  adminButtonGhost,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminOrderStatus, OrderStepState } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEP_DOT: Readonly<Record<OrderStepState, string>> = {
  done: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  current: "border-blue-500/45 bg-blue-500/15 text-blue-400",
  pending: "border-[#2A2A2A] bg-white/5 text-muted-foreground/60",
  cancelled: "border-rose-500/40 bg-rose-500/15 text-rose-400",
};

interface OrderDetailSheetProps {
  /** Order id without the leading "#"; null closes the sheet. */
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Full order view: customer, items, payment, timeline, notes and actions. */
export function OrderDetailSheet({ orderId, onOpenChange }: OrderDetailSheetProps) {
  const order = useAdminStore((state) =>
    orderId ? state.orders.find((entry) => entry.id === orderId) : undefined,
  );
  const updateOrderStatus = useAdminStore((state) => state.updateOrderStatus);
  const addOrderNote = useAdminStore((state) => state.addOrderNote);
  const refundOrder = useAdminStore((state) => state.refundOrder);

  const [nextStatus, setNextStatus] = useState<AdminOrderStatus>("pending");
  const [note, setNote] = useState("");
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);

  useEffect(() => {
    if (order) {
      setNextStatus(order.status);
      setNote("");
    }
  }, [order]);

  const open = Boolean(orderId && order);

  const applyStatus = () => {
    if (!order) return;
    updateOrderStatus(order.id, nextStatus);
    toast.success("Order status updated! ✅", {
      description: `${order.number} is now ${ADMIN_ORDER_STATUS_LABEL[nextStatus]}.`,
    });
  };

  const handleAddNote = () => {
    if (!order) return;
    const trimmed = note.trim();
    if (trimmed.length === 0) {
      toast.error("Write a note first");
      return;
    }
    addOrderNote(order.id, trimmed);
    setNote("");
    toast.success("Note added 📝");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full border-l border-[#242424] bg-[#141414] p-0 sm:max-w-xl"
        >
          {order && (
            <>
              <SheetHeader className="flex-row items-start justify-between gap-3 border-b border-[#242424] px-6 py-4">
                <div>
                  <SheetTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {order.number}
                    <OrderStatusBadge status={order.status} />
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-muted-foreground">
                    Placed {formatStamp(order.placedAt)} · {order.items.length} line items
                  </SheetDescription>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close order details"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-5">
                  {/* ---------- Customer ---------- */}
                  <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Customer
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          toast.success("Email drafted ✉️", {
                            description: `An update would go to ${order.customer.email}.`,
                          })
                        }
                        className={cn(adminButtonGhost, "min-h-9 px-3 text-xs")}
                      >
                        <Send aria-hidden className="size-3.5" />
                        Send Email to Customer
                      </button>
                    </header>
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <Detail label="Name" value={order.customer.name} />
                      <Detail label="Email" value={order.customer.email} />
                      <Detail label="Phone" value={order.customer.phone} />
                      <Detail label="Payment" value={order.paymentMethod} />
                    </dl>
                  </section>

                  {/* ---------- Items ---------- */}
                  <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Items
                    </h3>
                    <ul className="mt-3 flex flex-col gap-3">
                      {order.items.map((item) => (
                        <li key={item.lineId} className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-11 shrink-0 place-items-center rounded-lg bg-linear-to-br text-lg",
                              item.imageGradient,
                            )}
                          >
                            {item.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-foreground">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.size} · {item.color} · × {item.quantity}
                            </p>
                          </div>
                          <p className="text-xs font-medium text-foreground tabular-nums">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <dl className="mt-4 flex flex-col gap-1.5 border-t border-[#242424] pt-3 text-xs">
                      <Row label="Subtotal" value={formatPrice(order.totals.subtotal)} />
                      <Row label="Shipping" value={formatPrice(order.totals.shipping)} />
                      {order.totals.giftWrap > 0 && (
                        <Row label="Gift wrap" value={formatPrice(order.totals.giftWrap)} />
                      )}
                      {order.totals.discount > 0 && (
                        <Row
                          label="Discount"
                          value={`−${formatPrice(order.totals.discount)}`}
                          accent
                        />
                      )}
                      <div className="mt-1 flex justify-between border-t border-[#242424] pt-2 text-sm">
                        <dt className="font-medium text-foreground">Total</dt>
                        <dd className="font-semibold text-primary tabular-nums">
                          {formatPrice(order.totals.total)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* ---------- Shipping ---------- */}
                  <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      <MapPin aria-hidden className="size-3.5" />
                      Shipping address
                    </h3>
                    <address className="mt-3 text-xs leading-relaxed text-foreground not-italic">
                      {order.shipping.fullName}
                      <br />
                      {order.shipping.line1}
                      {order.shipping.line2 ? (
                        <>
                          <br />
                          {order.shipping.line2}
                        </>
                      ) : null}
                      <br />
                      {order.shipping.city}
                      {order.shipping.state ? `, ${order.shipping.state}` : ""}{' '}
                      {order.shipping.postalCode}
                      <br />
                      {order.shipping.country}
                      <br />
                      <span className="text-muted-foreground">{order.shipping.phone}</span>
                    </address>
                  </section>

                  {/* ---------- Status + timeline ---------- */}
                  <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Status
                    </h3>

                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <AdminField label="Change status" htmlFor="order-status" className="flex-1">
                        <select
                          id="order-status"
                          value={nextStatus}
                          onChange={(event) =>
                            setNextStatus(event.target.value as AdminOrderStatus)
                          }
                          className={adminSelectClass}
                        >
                          {ADMIN_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {ADMIN_ORDER_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </AdminField>
                      <button
                        type="button"
                        onClick={() => setConfirmStatus(true)}
                        disabled={nextStatus === order.status}
                        className={cn(adminButtonBlue, "min-h-10")}
                      >
                        Update
                      </button>
                    </div>

                    <ol className="mt-4 flex flex-col gap-0">
                      {order.timeline.map((step, index) => (
                        <li key={step.key} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span
                              aria-hidden
                              className={cn(
                                "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                                STEP_DOT[step.state],
                              )}
                            >
                              {step.emoji}
                            </span>
                            {index < order.timeline.length - 1 && (
                              <span aria-hidden className="w-px flex-1 bg-[#242424]" />
                            )}
                          </div>
                          <div className="pb-4">
                            <p
                              className={cn(
                                "text-xs font-medium",
                                step.state === "pending"
                                  ? "text-muted-foreground"
                                  : "text-foreground",
                              )}
                            >
                              {step.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {step.timestamp ? formatStamp(step.timestamp) : "Pending"}
                            </p>
                            {step.note && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                                {step.note}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  {/* ---------- Notes ---------- */}
                  <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Internal notes
                    </h3>

                    {order.notes.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-2">
                        <AnimatePresence initial={false}>
                          {order.notes.map((entry, index) => (
                            <motion.li
                              key={`${entry}-${index}`}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, ease: EASE }}
                              className="rounded-lg border border-[#242424] bg-[#141414] px-3 py-2 text-[11px] text-muted-foreground"
                            >
                              {entry}
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    ) : (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        No notes yet — visible to staff only.
                      </p>
                    )}

                    <div className="mt-3 flex flex-col gap-2">
                      <label htmlFor="order-note" className="sr-only">
                        Add a note
                      </label>
                      <textarea
                        id="order-note"
                        rows={2}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Packed with the gift note, ships Monday…"
                        className={cn(adminInputClass, "h-auto resize-y py-2 leading-relaxed")}
                      />
                      <button
                        type="button"
                        onClick={handleAddNote}
                        className={cn(adminButtonGhost, "min-h-9 self-start px-3")}
                      >
                        Add Note
                      </button>
                    </div>
                  </section>

                  {/* ---------- Invoice + refund ---------- */}
                  <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <button
                      type="button"
                      onClick={() =>
                        toast.info("Invoice opened 🧾", {
                          description: "Use your browser's print dialog to save a PDF.",
                        })
                      }
                      className={cn(adminButtonGhost, "min-h-10")}
                    >
                      <Printer aria-hidden className="size-3.5" />
                      Print Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toast.success("Receipt emailed 📧", {
                          description: `${order.number} sent to ${order.customer.email}.`,
                        })
                      }
                      className={cn(adminButtonGhost, "min-h-10")}
                    >
                      <Receipt aria-hidden className="size-3.5" />
                      Resend Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRefund(true)}
                      disabled={order.status === "refunded"}
                      className={cn(
                        adminButtonBlue,
                        "ml-auto min-h-10 bg-rose-500 text-white hover:bg-rose-400",
                      )}
                    >
                      Issue Refund
                    </button>
                  </section>

                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Mail aria-hidden className="size-3" />
                    Customer emails are mocked — nothing leaves the browser.
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={confirmStatus}
        onOpenChange={setConfirmStatus}
        title={`Mark as ${ADMIN_ORDER_STATUS_LABEL[nextStatus]}?`}
        description="The customer timeline updates immediately."
        confirmLabel={`Mark as ${ADMIN_ORDER_STATUS_LABEL[nextStatus]}`}
        onConfirm={applyStatus}
      />

      <ConfirmActionDialog
        open={confirmRefund}
        onOpenChange={setConfirmRefund}
        title="Issue a full refund?"
        description="The mock order moves to Refunded and the note is recorded on the order."
        confirmLabel="Issue refund"
        destructive
        onConfirm={() => {
          if (!order) return;
          refundOrder(order.id);
          toast.success("Refund issued 💸", { description: `${order.number} is now Refunded.` });
        }}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate text-xs text-foreground">{value}</dd>
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", accent ? "text-emerald-400" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
