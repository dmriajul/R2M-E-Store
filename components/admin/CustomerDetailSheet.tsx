"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Mail, MapPin, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatShortDate, initials } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ActiveBadge, OrderStatusBadge } from "@/components/admin/StatusBadge";
import { adminButtonBlue, adminButtonGhost, adminInputClass } from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";

const EASE = [0.22, 1, 0.36, 1] as const;

interface CustomerDetailSheetProps {
  /** Customer id; null closes the sheet. */
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Customer profile, lifetime stats, order history and staff notes. */
export function CustomerDetailSheet({ customerId, onOpenChange }: CustomerDetailSheetProps) {
  const customer = useAdminStore((state) =>
    customerId ? state.customers.find((entry) => entry.id === customerId) : undefined,
  );
  const orders = useAdminStore((state) => state.orders);
  const toggleCustomerActive = useAdminStore((state) => state.toggleCustomerActive);

  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);

  const history = customer
    ? orders.filter((order) => order.customer.email === customer.email)
    : [];

  const open = Boolean(customerId && customer);

  const handleAddNote = () => {
    const trimmed = note.trim();
    if (trimmed.length === 0) {
      toast.error("Write a note first");
      return;
    }
    setNotes((current) => [trimmed, ...current]);
    setNote("");
    toast.success("Note saved 📝");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full border-l border-[#242424] bg-[#141414] p-0 sm:max-w-lg"
      >
        {customer && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-3 border-b border-[#242424] px-6 py-4">
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">
                  {customer.name}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-muted-foreground">
                  Customer since {formatShortDate(customer.joinedAt)} · {customer.email}
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close customer details"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
              >
                <X aria-hidden className="size-4" />
              </button>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-5">
                {/* ---------- Profile ---------- */}
                <section className="flex flex-wrap items-center gap-4 rounded-xl border border-[#242424] bg-[#101010] p-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full border border-blue-500/35 bg-blue-500/12 text-base font-semibold text-blue-300">
                    {initials(customer.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{customer.phone}</p>
                  </div>
                  <ActiveBadge active={customer.active} />
                </section>

                {/* ---------- Stats ---------- */}
                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <p className="text-lg font-semibold text-foreground tabular-nums">
                      {customer.orderCount}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Orders
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <p className="text-lg font-semibold text-primary tabular-nums">
                      {formatPrice(customer.totalSpent)}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Total Spent
                    </p>
                  </div>
                </section>

                {/* ---------- Order history ---------- */}
                <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Order history
                  </h3>
                  {history.length === 0 ? (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      No orders in the demo dataset yet.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {history.map((order) => (
                        <li
                          key={order.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-[#242424] bg-[#141414] px-3 py-2"
                        >
                          <span className="text-xs font-medium text-foreground">
                            {order.number}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatShortDate(order.placedAt)}
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-foreground tabular-nums">
                              {formatPrice(order.totals.total)}
                            </span>
                            <OrderStatusBadge status={order.status} dot={false} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* ---------- Addresses ---------- */}
                <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    <MapPin aria-hidden className="size-3.5" />
                    Addresses
                  </h3>
                  <ul className="mt-3 flex flex-col gap-3">
                    {customer.addresses.map((address) => (
                      <li key={address.id} className="text-xs leading-relaxed text-foreground">
                        <span className="mb-1 inline-flex items-center gap-1.5 rounded border border-[#2A2A2A] px-1.5 py-px text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                          {address.label}
                        </span>
                        <br />
                        {address.fullName}, {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                        <br />
                        {address.city}
                        {address.state ? `, ${address.state}` : ""} {address.postalCode}
                        <br />
                        {address.country} · {address.phone}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* ---------- Notes ---------- */}
                <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Staff notes
                  </h3>
                  <AnimatePresence initial={false}>
                    {notes.length === 0 ? (
                      <motion.p
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 text-[11px] text-muted-foreground"
                      >
                        Nothing logged for this customer yet.
                      </motion.p>
                    ) : (
                      <motion.ul
                        key="notes"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 flex flex-col gap-2"
                      >
                        {notes.map((entry, index) => (
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
                      </motion.ul>
                    )}
                  </AnimatePresence>

                  <label htmlFor="customer-note" className="sr-only">
                    Add a note
                  </label>
                  <textarea
                    id="customer-note"
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Prefers express delivery, gift wrap every time…"
                    className={cn(adminInputClass, "mt-3 h-auto resize-y py-2 leading-relaxed")}
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className={cn(adminButtonGhost, "mt-2 min-h-9 px-3")}
                  >
                    Add Note
                  </button>
                </section>

                {/* ---------- Actions ---------- */}
                <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#242424] bg-[#101010] p-4">
                  <button
                    type="button"
                    onClick={() =>
                      toast.success("Email drafted ✉️", {
                        description: `A message would be sent to ${customer.email}.`,
                      })
                    }
                    className={cn(adminButtonGhost, "min-h-10")}
                  >
                    <Mail aria-hidden className="size-3.5" />
                    Send Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleCustomerActive(customer.id);
                      toast.success(
                        customer.active
                          ? `${customer.name} has been banned`
                          : `${customer.name} is active again ✅`,
                      );
                    }}
                    className={cn(
                      adminButtonBlue,
                      "ml-auto min-h-10",
                      customer.active
                        ? "bg-rose-500 text-white hover:bg-rose-400"
                        : "bg-emerald-500 text-white hover:bg-emerald-400",
                    )}
                  >
                    {customer.active ? (
                      <>
                        <Ban aria-hidden className="size-3.5" />
                        Ban customer
                      </>
                    ) : (
                      <>
                        <ShieldCheck aria-hidden className="size-3.5" />
                        Unban customer
                      </>
                    )}
                  </button>
                </section>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
