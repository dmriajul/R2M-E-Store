"use client";

import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";
import {
  COUPON_TYPE_LABEL,
  describeCouponValue,
  getCouponStatus,
} from "@/lib/mock-admin";
import { PRODUCT_CATEGORY_NAMES } from "@/lib/validations";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { CouponStatusBadge } from "@/components/admin/StatusBadge";
import { CouponDialog } from "@/components/admin/CouponDialog";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { adminButtonBlue, adminButtonGhost, adminInputClass } from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCoupon, CouponStatus } from "@/types";

type StatusFilter = "all" | CouponStatus;

const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "depleted", label: "Depleted" },
];

export default function AdminCouponsPage() {
  const coupons = useAdminStore((state) => state.coupons);
  const deleteCoupon = useAdminStore((state) => state.deleteCoupon);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCoupon | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return coupons.filter((coupon) => {
      const matchesTerm = term.length === 0 || coupon.code.toLowerCase().includes(term);
      const matchesStatus = status === "all" || getCouponStatus(coupon, DEMO_NOW) === status;
      return matchesTerm && matchesStatus;
    });
  }, [coupons, search, status]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditing(coupon);
    setDialogOpen(true);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} copied 📋`);
    } catch {
      toast.error("Clipboard blocked by the browser");
    }
  };

  const columns: readonly DataTableColumn<AdminCoupon>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      sortValue: (coupon) => coupon.code,
      render: (coupon) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs font-medium tracking-wider text-foreground">
            {coupon.code}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void copyCode(coupon.code);
            }}
            aria-label={`Copy ${coupon.code}`}
            className="inline-flex size-7 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Copy aria-hidden className="size-3" />
          </button>
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (coupon) => (
        <span className="text-muted-foreground">{COUPON_TYPE_LABEL[coupon.type]}</span>
      ),
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      sortValue: (coupon) => coupon.value,
      render: (coupon) => (
        <span className="font-medium text-foreground">{describeCouponValue(coupon)}</span>
      ),
    },
    {
      key: "minOrder",
      label: "Min Order",
      align: "right",
      sortable: true,
      sortValue: (coupon) => coupon.minOrder,
      render: (coupon) => (
        <span className="text-muted-foreground tabular-nums">
          {coupon.minOrder > 0 ? formatPrice(coupon.minOrder) : "$0.00"}
        </span>
      ),
    },
    {
      key: "uses",
      label: "Uses",
      align: "center",
      sortable: true,
      sortValue: (coupon) => coupon.uses,
      render: (coupon) => (
        <span className="text-muted-foreground tabular-nums">
          {coupon.uses} of {coupon.usageLimit === 0 ? "∞" : coupon.usageLimit}
        </span>
      ),
    },
    {
      key: "expiry",
      label: "Expiry",
      sortable: true,
      sortValue: (coupon) => coupon.endsAt,
      render: (coupon) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatShortDate(coupon.endsAt)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (coupon) => <CouponStatusBadge status={getCouponStatus(coupon, DEMO_NOW)} />,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      className: "w-24",
      render: (coupon) => (
        <span
          className="inline-flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEdit(coupon)}
            aria-label={`Edit ${coupon.code}`}
            title="Edit coupon"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Pencil aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(coupon)}
            aria-label={`Delete ${coupon.code}`}
            title="Delete coupon"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-rose-500/50 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="coupon-search" className="sr-only">
              Search coupons
            </label>
            <input
              id="coupon-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search codes..."
              className={adminInputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((entry) => {
              const active = status === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setStatus(entry.id)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                    active
                      ? "border-blue-500/50 bg-blue-500/12 text-blue-300"
                      : "border-[#2A2A2A] text-muted-foreground hover:border-[#3A3A3A] hover:text-foreground",
                  )}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openCreate}
            className={cn(adminButtonBlue, "ml-auto min-h-10")}
          >
            <Plus aria-hidden className="size-4" />
            Create Coupon
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {coupons.filter((coupon) => getCouponStatus(coupon, DEMO_NOW) === "active").length}{" "}
            live codes
          </span>
          <span aria-hidden>·</span>
          <span>
            {coupons.reduce((sum, coupon) => sum + coupon.uses, 0)} total redemptions
          </span>
          <button
            type="button"
            onClick={() =>
              toast.info("Coupon import is not part of the demo 🏷️", {
                description: "Create codes one at a time from this screen.",
              })
            }
            className={cn(adminButtonGhost, "ml-auto min-h-8 px-2 text-[11px]")}
          >
            Bulk import
          </button>
        </div>
      </section>

      <DataTable
        key={status}
        rows={rows}
        columns={columns}
        rowKey={(coupon) => coupon.id}
        initialSort={{ key: "expiry", direction: "asc" }}
        onRowClick={openEdit}
        emptyMessage="No coupons match this filter."
      />

      <CouponDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coupon={editing}
        categoryNames={PRODUCT_CATEGORY_NAMES}
      />

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this coupon?"
        description={
          pendingDelete ? `${pendingDelete.code} will stop working immediately.` : undefined
        }
        confirmLabel="Delete coupon"
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteCoupon(pendingDelete.id);
          toast.success(`${pendingDelete.code} deleted 🗑️`);
        }}
      />
    </div>
  );
}
