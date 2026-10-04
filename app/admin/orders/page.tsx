"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  Download,
  Eye,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";
import {
  ADMIN_ORDER_STATUS_LABEL,
  ADMIN_STATUSES,
  ORDER_STATS,
  ordersToCsv,
} from "@/lib/mock-admin";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { OrderDetailSheet } from "@/components/admin/OrderDetailSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminButtonGhost, adminInputClass } from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminOrder, AdminOrderStatus } from "@/types";

type StatusTab = "all" | AdminOrderStatus;
type DateRange = "all" | "7" | "30" | "custom";

const DAY = 86_400_000;

const STATUS_TABS: readonly { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
];

const DATE_RANGES: readonly { id: DateRange; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
];

export default function AdminOrdersPage() {
  const orders = useAdminStore((state) => state.orders);
  const updateOrderStatus = useAdminStore((state) => state.updateOrderStatus);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusTab>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const anchor = new Date(DEMO_NOW).getTime();

    return orders.filter((order) => {
      const matchesTerm =
        term.length === 0 ||
        order.number.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term) ||
        order.customer.name.toLowerCase().includes(term) ||
        order.customer.email.toLowerCase().includes(term);

      const matchesStatus = status === "all" || order.status === status;

      let matchesDate = true;
      const placed = new Date(order.placedAt).getTime();

      if (range === "7") matchesDate = anchor - placed <= 7 * DAY;
      else if (range === "30") matchesDate = anchor - placed <= 30 * DAY;
      else if (range === "custom" && customFrom) {
        const from = new Date(`${customFrom}T00:00:00Z`).getTime();
        const to = customTo ? new Date(`${customTo}T23:59:59Z`).getTime() : Number.POSITIVE_INFINITY;
        matchesDate = placed >= from && placed <= to;
      }

      return matchesTerm && matchesStatus && matchesDate;
    });
  }, [orders, search, status, range, customFrom, customTo]);

  const stats = useMemo(
    () =>
      [
        { label: "Total Orders", value: ORDER_STATS.total, accent: "text-foreground" },
        { label: "Pending", value: ORDER_STATS.pending, accent: "text-amber-400" },
        { label: "Shipped", value: ORDER_STATS.shipped, accent: "text-violet-400" },
        { label: "Delivered", value: ORDER_STATS.delivered, accent: "text-emerald-400" },
        { label: "Cancelled", value: ORDER_STATS.cancelled, accent: "text-rose-400" },
      ] as const,
    [],
  );

  const handleExport = () => {
    const csv = ordersToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `little-luxe-orders-${DEMO_NOW.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} orders 📥`);
  };

  const handleStatusChange = (order: AdminOrder, next: AdminOrderStatus) => {
    updateOrderStatus(order.id, next);
    toast.success("Order status updated! ✅", {
      description: `${order.number} is now ${ADMIN_ORDER_STATUS_LABEL[next]}.`,
    });
  };

  const columns: readonly DataTableColumn<AdminOrder>[] = [
    {
      key: "number",
      label: "Order #",
      sortable: true,
      sortValue: (order) => order.placedAt,
      render: (order) => (
        <span className="font-medium whitespace-nowrap text-foreground">{order.number}</span>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      sortable: true,
      sortValue: (order) => order.customer.name,
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{order.customer.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{order.customer.email}</p>
        </div>
      ),
    },
    {
      key: "items",
      label: "Items",
      align: "center",
      sortable: true,
      sortValue: (order) => order.items.reduce((sum, item) => sum + item.quantity, 0),
      render: (order) => (
        <span className="text-muted-foreground tabular-nums">
          {order.items.reduce((sum, item) => sum + item.quantity, 0)}
        </span>
      ),
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      sortable: true,
      sortValue: (order) => order.totals.total,
      render: (order) => (
        <span className="font-medium text-foreground tabular-nums">
          {formatPrice(order.totals.total)}
        </span>
      ),
    },
    {
      key: "payment",
      label: "Payment",
      render: (order) => (
        <span className="text-muted-foreground whitespace-nowrap">{order.paymentMethod}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      sortValue: (order) => order.placedAt,
      render: (order) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatShortDate(order.placedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      className: "w-40",
      render: (order) => (
        <span
          className="inline-flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setActiveOrderId(order.id)}
            aria-label={`View ${order.number}`}
            title="View details"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Eye aria-hidden className="size-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Update status for ${order.number}`}
                title="Update status"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#2A2A2A] px-2 text-[11px] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
              >
                <RefreshCw aria-hidden className="size-3.5" />
                <ChevronDown aria-hidden className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 border-[#2A2A2A] bg-[#141414]">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Update status
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#242424]" />
              <DropdownMenuRadioGroup
                value={order.status}
                onValueChange={(value) => handleStatusChange(order, value as AdminOrderStatus)}
              >
                {ADMIN_STATUSES.map((entry) => (
                  <DropdownMenuRadioItem
                    key={entry}
                    value={entry}
                    className="text-xs focus:bg-white/6"
                  >
                    {ADMIN_ORDER_STATUS_LABEL[entry]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() =>
              toast.info("Invoice opened 🧾", {
                description: `${order.number} — use the print dialog to save a PDF.`,
              })
            }
            aria-label={`Print invoice for ${order.number}`}
            title="Print invoice"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Printer aria-hidden className="size-3.5" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Stats ---------- */}
      <section aria-label="Order statistics" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-xl border border-[#242424] bg-[#141414] p-4 transition-colors duration-200 hover:border-blue-500/30"
          >
            <p className={cn("text-xl font-semibold tabular-nums", stat.accent)}>{stat.value}</p>
            <p className="mt-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              {stat.label}
            </p>
          </article>
        ))}
      </section>

      {/* ---------- Filters ---------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="order-search" className="sr-only">
              Search orders
            </label>
            <input
              id="order-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order # or customer..."
              className={adminInputClass}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(adminButtonGhost, "min-h-10")}>
                <CalendarRange aria-hidden className="size-3.5" />
                {DATE_RANGES.find((entry) => entry.id === range)?.label}
                <ChevronDown aria-hidden className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 border-[#2A2A2A] bg-[#141414]">
              <DropdownMenuRadioGroup
                value={range}
                onValueChange={(value) => setRange(value as DateRange)}
              >
                {DATE_RANGES.map((entry) => (
                  <DropdownMenuRadioItem
                    key={entry.id}
                    value={entry.id}
                    className="text-xs focus:bg-white/6"
                  >
                    {entry.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button type="button" onClick={handleExport} className={cn(adminButtonGhost, "min-h-10")}>
            <Download aria-hidden className="size-3.5" />
            Export CSV 📥
          </button>
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="order-from" className="text-[11px] text-muted-foreground uppercase">
                From
              </label>
              <input
                id="order-from"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={cn(adminInputClass, "w-40")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="order-to" className="text-[11px] text-muted-foreground uppercase">
                To
              </label>
              <input
                id="order-to"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className={cn(adminInputClass, "w-40")}
              />
            </div>
          </div>
        )}

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.id;
            const count =
              tab.id === "all"
                ? orders.length
                : orders.filter((order) => order.status === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(tab.id)}
                className={cn(
                  "min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                  active
                    ? "border-blue-500/50 bg-blue-500/12 text-blue-300"
                    : "border-[#2A2A2A] text-muted-foreground hover:border-[#3A3A3A] hover:text-foreground",
                )}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- Table ---------- */}
      <DataTable
        key={`${status}-${range}-${customFrom}-${customTo}`}
        rows={rows}
        columns={columns}
        rowKey={(order) => order.id}
        initialSort={{ key: "number", direction: "desc" }}
        onRowClick={(order) => setActiveOrderId(order.id)}
        emptyMessage="No orders match these filters."
      />

      <p className="text-[11px] text-muted-foreground">
        Showing {rows.length} of {orders.length} demo orders. Date ranges are measured from the
        demo “today”, {formatShortDate(DEMO_NOW)}.
      </p>

      <OrderDetailSheet
        orderId={activeOrderId}
        onOpenChange={(open) => !open && setActiveOrderId(null)}
      />
    </div>
  );
}
