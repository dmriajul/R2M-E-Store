"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MAX_ADDRESSES, useDashboardStore } from "@/store/useDashboardStore";
import { AddressFormDialog } from "@/components/dashboard/AddressFormDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Address } from "@/types";

function AddressCard({
  address,
  index,
  onEdit,
  onDelete,
}: {
  address: Address;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const setDefaultAddress = useDashboardStore((state) => state.setDefaultAddress);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={cn(
        "glass-soft shadow-playful flex flex-col gap-4 rounded-2xl border p-5 transition-colors duration-500 ease-[var(--ease-luxe)]",
        address.isDefault ? "border-primary/35" : "border-glass-border hover:border-primary/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <MapPin aria-hidden className="size-3" />
            {address.label}
          </span>
          {address.isDefault && (
            <Badge className="gap-1 rounded-full border-primary/35 bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
              <BadgeCheck aria-hidden className="size-3" />
              Default
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${address.label} address`}
            className="inline-flex size-9 items-center justify-center rounded-full border border-glass-border bg-glass text-muted-foreground transition-colors duration-300 hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Pencil aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${address.label} address`}
            className="inline-flex size-9 items-center justify-center rounded-full border border-glass-border bg-glass text-muted-foreground transition-colors duration-300 hover:border-rose/40 hover:text-rose focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="text-sm">
        <p className="font-medium text-foreground">{address.fullName}</p>
        <p className="text-muted-foreground">{address.line1}</p>
        {address.line2 && <p className="text-muted-foreground">{address.line2}</p>}
        <p className="text-muted-foreground">
          {address.city}
          {address.state ? `, ${address.state}` : ""} {address.postalCode}
        </p>
        <p className="text-muted-foreground">{address.country}</p>
        <p className="mt-2 text-xs text-muted-foreground">{address.phone}</p>
      </div>

      {!address.isDefault && (
        <button
          type="button"
          onClick={() => {
            setDefaultAddress(address.id);
            toast.success(`${address.label} is now your default 📍`);
          }}
          className="inline-flex items-center gap-1.5 self-start rounded-full text-[11px] font-semibold tracking-[0.14em] text-primary uppercase transition-colors duration-300 hover:text-gold-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Star aria-hidden className="size-3" />
          Set as Default
        </button>
      )}
    </motion.article>
  );
}

/** Saved addresses: up to three, each editable and deletable. */
export function AddressBook() {
  const addresses = useDashboardStore((state) => state.addresses);
  const removeAddress = useDashboardStore((state) => state.removeAddress);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);

  const atLimit = addresses.length >= MAX_ADDRESSES;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {addresses.length} of {MAX_ADDRESSES} saved addresses
          {atLimit ? " · remove one to add another" : ""}
        </p>
        <Button
          type="button"
          disabled={atLimit}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="h-11 rounded-full bg-primary px-5 text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.9)] disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add New Address
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {addresses.map((address, index) => (
            <AddressCard
              key={address.id}
              address={address}
              index={index}
              onEdit={() => {
                setEditing(address);
                setFormOpen(true);
              }}
              onDelete={() => setPendingDelete(address)}
            />
          ))}
        </AnimatePresence>
      </div>

      {addresses.length === 0 && (
        <div className="glass-soft flex flex-col items-center gap-3 rounded-3xl border border-glass-border px-6 py-14 text-center">
          <span aria-hidden className="text-5xl">
            📍
          </span>
          <h3 className="text-lg font-bold">No addresses saved</h3>
          <p className="prose-kids max-w-sm text-sm text-muted-foreground">
            Add one now and checkout will take seconds next time.
          </p>
        </div>
      )}

      <AddressFormDialog open={formOpen} onOpenChange={setFormOpen} address={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={`Delete ${pendingDelete?.label ?? "address"}?`}
        description="Are you sure? This can't be undone."
        confirmLabel="Delete Address"
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          removeAddress(pendingDelete.id);
          toast.success("Address deleted", {
            description: `${pendingDelete.label} was removed from your address book.`,
          });
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
