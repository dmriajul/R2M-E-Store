"use client";

import { useMemo, useState } from "react";
import { Ban, Eye, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatShortDate, initials } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { ActiveBadge } from "@/components/admin/StatusBadge";
import { CustomerDetailSheet } from "@/components/admin/CustomerDetailSheet";
import { adminInputClass } from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCustomer } from "@/types";

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

export default function AdminCustomersPage() {
  const customers = useAdminStore((state) => state.customers);
  const toggleCustomerActive = useAdminStore((state) => state.toggleCustomerActive);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesTerm =
        term.length === 0 ||
        customer.name.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term);
      const matchesStatus =
        status === "all" || (status === "active" ? customer.active : !customer.active);
      return matchesTerm && matchesStatus;
    });
  }, [customers, search, status]);

  const handleToggleActive = (customer: AdminCustomer) => {
    toggleCustomerActive(customer.id);
    toast.success(
      customer.active
        ? `${customer.name} has been banned 🚫`
        : `${customer.name} is active again ✅`,
    );
  };

  const columns: readonly DataTableColumn<AdminCustomer>[] = [
    {
      key: "avatar",
      label: "Avatar",
      className: "w-14",
      render: (customer) => (
        <span className="grid size-9 place-items-center rounded-full border border-blue-500/30 bg-blue-500/12 text-[11px] font-semibold text-blue-300">
          {initials(customer.name)}
        </span>
      ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      sortValue: (customer) => customer.name,
      render: (customer) => (
        <span className="font-medium whitespace-nowrap text-foreground">{customer.name}</span>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      sortValue: (customer) => customer.email,
      render: (customer) => (
        <span className="text-muted-foreground">{customer.email}</span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (customer) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {customer.phone}
        </span>
      ),
    },
    {
      key: "orders",
      label: "Orders",
      align: "center",
      sortable: true,
      sortValue: (customer) => customer.orderCount,
      render: (customer) => (
        <span className="text-foreground tabular-nums">{customer.orderCount}</span>
      ),
    },
    {
      key: "spent",
      label: "Total Spent",
      align: "right",
      sortable: true,
      sortValue: (customer) => customer.totalSpent,
      render: (customer) => (
        <span className="font-medium text-foreground tabular-nums">
          {formatPrice(customer.totalSpent)}
        </span>
      ),
    },
    {
      key: "joined",
      label: "Joined",
      sortable: true,
      sortValue: (customer) => customer.joinedAt,
      render: (customer) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatShortDate(customer.joinedAt)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (customer) => <ActiveBadge active={customer.active} />,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      className: "w-32",
      render: (customer) => (
        <span
          className="inline-flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setActiveId(customer.id)}
            aria-label={`View ${customer.name}`}
            title="View profile"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Eye aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              toast.success("Email drafted ✉️", {
                description: `A message would be sent to ${customer.email}.`,
              })
            }
            aria-label={`Email ${customer.name}`}
            title="Send email"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Mail aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleActive(customer)}
            aria-label={customer.active ? `Ban ${customer.name}` : `Unban ${customer.name}`}
            title={customer.active ? "Ban customer" : "Unban customer"}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
              customer.active
                ? "hover:border-rose-500/50 hover:text-rose-400"
                : "hover:border-emerald-500/50 hover:text-emerald-400",
            )}
          >
            {customer.active ? (
              <Ban aria-hidden className="size-3.5" />
            ) : (
              <ShieldCheck aria-hidden className="size-3.5" />
            )}
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
            <label htmlFor="customer-search" className="sr-only">
              Search customers
            </label>
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email..."
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

          <p className="ml-auto text-xs text-muted-foreground tabular-nums">
            {customers.length} customers
          </p>
        </div>
      </section>

      <DataTable
        key={status}
        rows={rows}
        columns={columns}
        rowKey={(customer) => customer.id}
        initialSort={{ key: "spent", direction: "desc" }}
        onRowClick={(customer) => setActiveId(customer.id)}
        emptyMessage="No customers match this search."
      />

      <CustomerDetailSheet
        customerId={activeId}
        onOpenChange={(open) => !open && setActiveId(null)}
      />
    </div>
  );
}
