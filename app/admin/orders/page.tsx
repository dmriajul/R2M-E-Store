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
import { cn, formatShortDate } from "@/lib/utils";
import {
  ADMIN_ORDER_STATUS_LABEL,
  ADMIN_STATUSES,
  ORDER_STATS,
  ordersToCsv,
} from "@/lib/mock-admin";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";
import { paymentMethodFromLabel } from "@/lib/payments";
import {
  formatMoney,
} from "@/lib/config";
import { OrderDetailSheet } from "@/components/admin/OrderDetailSheet";
import { ScreenshotViewer } from "@/components/admin/ScreenshotViewer";
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
import { useLanguageStore } from "@/store/useLanguageStore";
import type { AdminOrder, AdminOrderStatus } from "@/types";

type StatusTab = "all" | AdminOrderStatus;
type DateRange = "all" | "7" | "30" | "custom";

const DAY = 86_400_000;

const STATUS_TABS: readonly { id: StatusTab; label: { en: string; bn: string } }[] = [
  { id: "all", label: { en: "All", bn: "সব" } },
  { id: "pending", label: { en: "Pending", bn: "লম্বা" } },
  { id: "processing", label: { en: "Processing", bn: "প্রক্রিয়াকরণ" } },
  { id: "shipped", label: { en: "Shipped", bn: "পাঠানো হয়েছে" } },
  { id: "delivered", label: { en: "Delivered", bn: "বিতরণ" } },
  { id: "cancelled", label: { en: "Cancelled", bn: "বাতিল" } },
  { id: "refunded", label: { en: "Refunded", bn: "মুদ্রিত" } },
];

const DATE_RANGES: readonly { id: DateRange; label: { en: string; bn: string } }[] = [
  { id: "all", label: { en: "All time", bn: "সব সময়" } },
  { id: "7", label: { en: "Last 7 days", bn: "গত ৭ দিন" } },
  { id: "30", label: { en: "Last 30 days", bn: "গত ৩০ দিন" } },
  { id: "custom", label: { en: "Custom range", bn: "কাস্টম রেঞ্জ" } },
];

export default function AdminOrdersPage() {
  const orders = useAdminStore((state) => state.orders);
  const updateOrderStatus = useAdminStore((state) => state.updateOrderStatus);
  const verifyPayment = useAdminStore((state) => state.verifyPayment);
  const rejectPayment = useAdminStore((state) => state.rejectPayment);

  const language = useLanguageStore((state) => state.language);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusTab>("all");
  const [range, setRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [approvalLoading, setApprovalLoading] = useState<string | null>(null);

  const t = (key: string) => {
    const translations: Record<string, string> = {
      allOrders: language === "bn" ? "সব অর্ডার" : "All Orders",
      pendingOrders: language === "bn" ? "লম্বা অর্ডার" : "Pending Orders",
      processingOrders: language === "bn" ? "প্রক্রিয়াকরণে" : "Processing",
      "Order statistics": language === "bn" ? "অর্ডার পরিসংখ্যান" : "Order statistics",
      searchOrders: language === "bn" ? "অর্ডার খুঁজুন" : "Search orders",
      "Search order # or customer...": language === "bn" ? "অর্ডার # অথবা গ্রাহক খুঁজুন..." : "Search order # or customer...",
      exportCsv: language === "bn" ? "CSV রপ্তানি 📥" : "Export CSV 📥",
      updateStatus: language === "bn" ? "স্ট্যাটাস আপডেট করুন" : "Update status",
      viewDetails: language === "bn" ? "বিস্তারিত দেখুন" : "View details",
      printInvoice: language === "bn" ? "ইনভয়েস প্রিন্ট করুন" : "Print invoice",
      noOrders: language === "bn" ? "এই ফিল্টারে কোনো অর্ডার নেই।" : "No orders match these filters.",
      demoDate: language === "bn" ? "ডেমো \"আজ\", " : "demo 'today', ",
    };
    return translations[key] ?? key;
  };

  const showingOf = (a: number, b: number) =>
    language === "bn" ? `${b} থেকে ${a}টি দেখাচ্ছে` : `Showing ${a} of ${b}`;

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
        {
          label: language === "bn" ? "মোট অর্ডার" : "Total Orders",
          value: ORDER_STATS.total,
          accent: "text-foreground",
        },
        {
          label: language === "bn" ? "লম্বা" : "Pending",
          value: ORDER_STATS.pending,
          accent: "text-amber-400",
        },
        {
          label: language === "bn" ? "পাঠানো হয়েছে" : "Shipped",
          value: ORDER_STATS.shipped,
          accent: "text-violet-400",
        },
        {
          label: language === "bn" ? "বিতরণ" : "Delivered",
          value: ORDER_STATS.delivered,
          accent: "text-emerald-400",
        },
        {
          label: language === "bn" ? "বাতিল" : "Cancelled",
          value: ORDER_STATS.cancelled,
          accent: "text-rose-400",
        },
      ] as const,
    [language],
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
    toast.success(
      language === "bn" ? `${rows.length}টি অর্ডার রপ্তানি করা হয়েছে 📥` : `Exported ${rows.length} orders 📥`,
    );
  };

  const handleStatusChange = (order: AdminOrder, next: AdminOrderStatus) => {
    updateOrderStatus(order.id, next);
    const statusLabel =
      language === "bn"
        ? {
            pending: "লম্বা",
            processing: "প্রক্রিয়াকরণ",
            shipped: "পাঠানো হয়েছে",
            delivered: "বিতরণ",
            cancelled: "বাতিল",
            refunded: "মুদ্রিত",
          }
        : {
            pending: "Pending",
            processing: "Processing",
            shipped: "Shipped",
            delivered: "Delivered",
            cancelled: "Cancelled",
            refunded: "Refunded",
          };
    toast.success(
      language === "bn" ? "অর্ডার স্ট্যাটাস আপডেট! ✅" : "Order status updated! ✅",
      {
        description: `${order.number} এখন ${statusLabel[next]}।`,
      },
    );
  };

  const handlePaymentVerification = async (
    order: AdminOrder,
    action: "approve" | "reject",
  ) => {
    const orderNumber = order.number;
    setApprovalLoading(order.id);

    try {
      // Simulate verification delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (action === "approve") {
        verifyPayment(order.id);
        toast.success(
          language === "bn" ? "পেমেন্ট অনুমোদন করা হয়েছে! ✅" : "Payment approved! ✅",
          {
            description: `${orderNumber} এর পেমেন্ট যাচাইকরণ সম্পন্ন।`,
          },
        );
      } else {
        rejectPayment(order.id);
        toast.success(
          language === "bn" ? "পেমেন্ট প্রত্যাখ্যান করা হয়েছে ❌" : "Payment rejected ❌",
          {
            description: `${orderNumber} এর পেমেন্ট যাচাইকরণ ব্যর্থ।`,
          },
        );
      }
    } catch {
      toast.error(
        language === "bn" ? "যাচাইকরণ ব্যর্থ হয়েছে" : "Verification failed",
      );
    } finally {
      setApprovalLoading(null);
      setVerifyingOrderId(null);
    }
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
      label: language === "bn" ? "গ্রাহক" : "Customer",
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
      label: language === "bn" ? "আইটেম" : "Items",
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
      label: language === "bn" ? "মোট" : "Total",
      align: "right",
      sortable: true,
      sortValue: (order) => order.totals.total,
      render: (order) => (
        <span className="font-medium text-foreground tabular-nums">
          {formatMoney(order.totals.total)}
        </span>
      ),
    },
    {
      key: "payment",
      label: language === "bn" ? "পেমেন্ট" : "Payment",
      render: (order) => {
        const kind = paymentMethodFromLabel(order.paymentMethod);
        return (
          <span className="flex flex-col gap-1 whitespace-nowrap">
            <span className="text-muted-foreground">{order.paymentMethod}</span>
            <PaymentStatusBadge
              status={order.paymentStatus ?? (kind === "COD" ? "UNPAID" : "PAID")}
            />
          </span>
        );
      },
    },
    {
      key: "status",
      label: language === "bn" ? "স্ট্যাটাস" : "Status",
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: "date",
      label: language === "bn" ? "তারিখ" : "Date",
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
      label: language === "bn" ? "কার্যক্রম" : "Actions",
      align: "right",
      className: "w-48",
      render: (order) => (
        <span
          className="inline-flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setActiveOrderId(order.id)}
            aria-label={`View ${order.number}`}
            title={language === "bn" ? "বিস্তারিত দেখুন" : "View details"}
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Eye aria-hidden className="size-3.5" />
          </button>

          {/* Payment verification button for manual payments */}
          {(order.paymentStatus === "PENDING" ||
            (order.paymentStatus === "PAID" && order.paymentMethod.toLowerCase().includes("bkash"))) && (
            <button
              type="button"
              onClick={() => setVerifyingOrderId(order.id)}
              aria-label={`Verify payment for ${order.number}`}
              title={language === "bn" ? "পেমেন্ট যাচাইকরণ" : "Verify payment"}
              className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-blue-500/50 hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
            >
              <RefreshCw aria-hidden className="size-3.5" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Update status for ${order.number}`}
                title={language === "bn" ? "স্ট্যাটাস আপডেট করুন" : "Update status"}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#2A2A2A] px-2 text-[11px] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
              >
                <RefreshCw aria-hidden className="size-3.5" />
                <ChevronDown aria-hidden className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 border-[#2A2A2A] bg-[#141414]">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                {language === "bn" ? "স্ট্যাটাস আপডেট করুন" : "Update status"}
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
              toast.info(
                language === "bn" ? "ইনভয়েস খোলা হয়েছে 🧾" : "Invoice opened 🧾",
                {
                  description: `${order.number} — use the print dialog to save a PDF.`,
                },
              )
            }
            aria-label={`Print invoice for ${order.number}`}
            title={language === "bn" ? "ইনভয়েস প্রিন্ট করুন" : "Print invoice"}
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
      <section aria-label={t("Order statistics")} className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
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
              {t("searchOrders")}
            </label>
            <input
              id="order-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search order # or customer...")}
              className={adminInputClass}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(adminButtonGhost, "min-h-10")}>
                <CalendarRange aria-hidden className="size-3.5" />
                {DATE_RANGES.find((entry) => entry.id === range)?.label[language]}
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
                    {entry.label[language]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button type="button" onClick={handleExport} className={cn(adminButtonGhost, "min-h-10")}>
            <Download aria-hidden className="size-3.5" />
            {t("exportCsv")}
          </button>
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="order-from" className="text-[11px] text-muted-foreground uppercase">
                {language === "bn" ? "শুরু" : "From"}
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
                {language === "bn" ? "শেষ" : "To"}
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
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={language === "bn" ? "স্ট্যাটাস দ্বারা ফিল্টার" : "Filter by status"}>
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
                {tab.label[language]}
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
        emptyMessage={t("noOrders")}
      />

      <p className="text-[11px] text-muted-foreground">
        {showingOf(rows.length, orders.length)}{" "}
        {t("demoDate")}{formatShortDate(DEMO_NOW)}.
      </p>

      <OrderDetailSheet
        orderId={activeOrderId}
        onOpenChange={(open) => !open && setActiveOrderId(null)}
      />

      {/* Payment verification modal */}
      <ScreenshotViewer
        isOpen={!!verifyingOrderId}
        onClose={() => setVerifyingOrderId(null)}
        orderNumber={activeOrderId ? `#${activeOrderId}` : "LL-00000"}
        screenshotUrl={
          activeOrderId
            ? orders.find((o) => o.id === activeOrderId)?.paymentRef ?? null
            : null
        }
        onApprove={() => {
          const order = orders.find((o) => o.id === activeOrderId);
          if (order) handlePaymentVerification(order, "approve");
        }}
        onReject={() => {
          const order = orders.find((o) => o.id === activeOrderId);
          if (order) handlePaymentVerification(order, "reject");
        }}
        isVerifying={!!approvalLoading}
      />
    </div>
  );
}
