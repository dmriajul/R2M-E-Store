"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, Check, Download, Loader2, PackageOpen, RefreshCw, Search, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminInputClass } from "@/components/admin/Field";
import { MobileReturnsList, ReturnsTable } from "@/components/admin/returns/ReturnsList";
import { ReturnReviewDialog, type ReturnReviewTarget } from "@/components/admin/returns/ReturnReviewDialog";
import { ReturnsSkeleton } from "@/components/admin/returns/ReturnsSkeleton";
import { useAdminReturns } from "@/hooks/useAdminReturns";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { RETURN_STATUSES, type ReturnAction } from "@/lib/admin-returns";
import { cn } from "@/lib/utils";
import type { ReturnRequestRecord, ReturnStatusKey, ReturnTypeKey } from "@/types";

const outline = "min-h-11 min-w-11 rounded-xl border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white";
const labelFor = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export default function AdminReturnsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [statuses, setStatuses] = useState<ReturnStatusKey[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<ReturnTypeKey | "">("");
  const [target, setTarget] = useState<ReturnReviewTarget | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const mobile = useMediaQuery("(max-width: 639px)");
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statuses.length) params.set("status", [...statuses].sort().join(","));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (type) params.set("type", type);
    return params.toString();
  }, [debouncedSearch, statuses, from, to, type]);
  const returns = useAdminReturns(query);
  const busy = Boolean(returns.updatingId);
  const searchPending = search.trim() !== debouncedSearch;
  const refreshDisabled = returns.refreshing || returns.loadingMore || busy || returns.offline;
  const pull = usePullToRefresh(rootRef, returns.refresh, refreshDisabled || Boolean(target));
  const hasFilters = Boolean(search || statuses.length || from || to || type);
  const clearFilters = () => { setSearch(""); setStatuses([]); setFrom(""); setTo(""); setType(""); };
  const review = useCallback((request: ReturnRequestRecord, action?: ReturnAction) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTarget({ request, action });
  }, []);
  const restoreFocus = () => {
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
    else headingRef.current?.focus();
  };
  const toggleSearch = () => {
    setSearchOpen((open) => !open);
    if (!searchOpen) requestAnimationFrame(() => searchRef.current?.focus());
  };
  const chips = [
    ...(debouncedSearch ? [{ key: "search", label: `Search: ${debouncedSearch}`, clear: () => setSearch("") }] : []),
    ...statuses.map((status) => ({ key: status, label: labelFor(status), clear: () => setStatuses((values) => values.filter((value) => value !== status)) })),
    ...(from ? [{ key: "from", label: `From ${from}`, clear: () => setFrom("") }] : []),
    ...(to ? [{ key: "to", label: `Until ${to}`, clear: () => setTo("") }] : []),
    ...(type ? [{ key: "type", label: labelFor(type), clear: () => setType("") }] : []),
  ];

  return <section ref={rootRef} aria-labelledby="returns-title" data-testid="returns-page" className="mx-auto min-w-0 max-w-[1600px] space-y-5 pb-24 text-sm text-slate-100 sm:pb-6">
    {pull > 0 && <div role="status" className="flex items-center justify-center gap-2 text-sm text-primary sm:hidden" style={{ height: pull }}><ArrowDown aria-hidden className={cn("size-4", pull >= 70 && "rotate-180")} />{pull >= 70 ? "Release to refresh" : "Pull to refresh"}</div>}
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">Customer care</p>
        <h2 ref={headingRef} tabIndex={-1} id="returns-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 outline-none sm:text-3xl">Returns &amp; exchanges</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Resolve requests with confidence. Review the item, make a decision, and keep customers in the loop.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={refreshDisabled} onClick={() => void returns.refresh()} aria-label="Refresh returns" aria-keyshortcuts="R" className={cn(outline, "hidden sm:inline-flex")}><RefreshCw aria-hidden className={cn("size-4", returns.refreshing && "animate-spin")} />Refresh<span className="hidden text-slate-300 lg:inline">· R</span></Button>
        <Button type="button" variant="outline" disabled={returns.exporting || returns.offline || busy || returns.loading} onClick={() => void returns.exportCsv()} aria-label="Export all filtered returns as CSV" className={cn(outline, "hidden lg:inline-flex")}>{returns.exporting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}{returns.exporting ? "Exporting…" : "Export CSV"}</Button>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-[#0B1224] px-3 py-2 text-sm text-slate-200">
          <input type="checkbox" role="switch" checked={returns.autoRefresh} onChange={(event) => returns.toggleAutoRefresh(event.target.checked)} className="size-5 accent-[var(--primary)]" />Auto-refresh every 30 seconds
        </label>
      </div>
    </header>

    {returns.offline && <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200/30 bg-amber-200/10 p-3 text-sm text-amber-100"><WifiOff aria-hidden className="mt-0.5 size-5 shrink-0" /><p>You are offline. Showing the last loaded requests. Changes and refresh are paused until you reconnect.</p></div>}
    {returns.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/30 bg-rose-200/10 p-4 text-sm text-rose-100">
      <div className="flex min-w-0 flex-1 items-start gap-2"><AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">{returns.error}</p>{returns.errorDetail && returns.errorDetail !== returns.error && <p className="mt-1 break-words">{returns.errorDetail}</p>}{returns.rows.length > 0 && <p className="mt-1">Your last loaded list is still available and may be out of date.</p>}</div></div>
      <Button type="button" variant="outline" disabled={refreshDisabled} onClick={() => void returns.refresh()} aria-label="Retry loading returns" className={outline}>Try again</Button>
    </div>}

    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Returns overview">
      {[
        { label: "Total requests", value: returns.summary.total, color: "text-slate-50" },
        { label: "Awaiting review", value: returns.summary.pending, color: "text-amber-200" },
        { label: "Urgent · over 3 days", value: returns.summary.urgent, color: "text-rose-200" },
      ].map((stat) => <div key={stat.label} className="rounded-xl border border-white/15 bg-[#0B1224] p-3 sm:p-4"><p className={cn("text-2xl font-semibold tabular-nums", stat.color)}>{returns.updatedAt ? stat.value : "—"}</p><p className="mt-1 text-sm text-slate-300">{stat.label}</p></div>)}
    </div>

    <fieldset disabled={busy} className="min-w-0 space-y-4 rounded-2xl border border-white/15 bg-[#0B1224] p-3 sm:p-4">
      <legend className="sr-only">Search and filter return requests</legend>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={toggleSearch} aria-label={searchOpen ? "Collapse returns search" : "Expand returns search"} aria-expanded={searchOpen} aria-controls="returns-search-group" className={cn(outline, "size-11 p-0 sm:hidden")}>{searchOpen ? <X aria-hidden className="size-5" /> : <Search aria-hidden className="size-5" />}</Button>
        <div id="returns-search-group" className={cn("relative min-w-0 flex-1 basis-full sm:basis-auto", searchOpen ? "block" : "hidden sm:block")}>
          <label htmlFor="returns-search" className="sr-only">Search by customer, order ID or request ID</label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-300" />
          <input ref={searchRef} id="returns-search" type="search" maxLength={150} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Customer, order or request ID…" className={cn(adminInputClass, "min-h-11 border-white/20 bg-[#101a30] pl-9 text-sm placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/30")} />
        </div>
        <Button type="button" variant="outline" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} aria-controls="returns-advanced-filters" className={cn(outline, "sm:hidden")}><SlidersHorizontal aria-hidden className="size-4" />{advancedOpen ? "Hide filters" : "More filters"}</Button>
        {hasFilters && <Button type="button" variant="ghost" onClick={clearFilters} className="ml-auto min-h-11 px-3 text-sm text-primary hover:bg-primary/10 hover:text-primary">Clear all filters</Button>}
      </div>
      <div role="group" aria-label="Filter by status; select one or more" className="flex max-w-full gap-2 overflow-x-auto pb-1">
        <button type="button" aria-pressed={statuses.length === 0} onClick={() => setStatuses([])} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary", statuses.length === 0 ? "border-primary/60 bg-primary/15 text-primary" : "border-white/20 text-slate-200 hover:bg-white/5")}>All requests</button>
        {RETURN_STATUSES.map((status) => <button key={status} type="button" aria-pressed={statuses.includes(status)} onClick={() => setStatuses((values) => values.includes(status) ? values.filter((v) => v !== status) : [...values, status])} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary", statuses.includes(status) ? "border-primary/60 bg-primary/15 text-primary" : "border-white/20 text-slate-200 hover:bg-white/5")}>{statuses.includes(status) && <Check aria-hidden className="size-4" />}{labelFor(status)}</button>)}
      </div>
      <div id="returns-advanced-filters" className={cn("grid-cols-1 gap-3 sm:grid-cols-3", advancedOpen ? "grid" : "hidden sm:grid")}>
        <label className="flex min-w-0 flex-col gap-2 text-sm text-slate-300" htmlFor="returns-from">From date (UTC)<input id="returns-from" type="date" value={from} onChange={(event) => { const value = event.target.value; setFrom(value); if (to && value > to) setTo(value); }} className={cn(adminInputClass, "min-h-11 min-w-0 border-white/20 bg-[#101a30] [color-scheme:dark]")} /></label>
        <label className="flex min-w-0 flex-col gap-2 text-sm text-slate-300" htmlFor="returns-to">Until date (UTC)<input id="returns-to" type="date" value={to} onChange={(event) => { const value = event.target.value; setTo(value); if (from && value && value < from) setFrom(value); }} className={cn(adminInputClass, "min-h-11 min-w-0 border-white/20 bg-[#101a30] [color-scheme:dark]")} /></label>
        <div className="flex min-w-0 flex-col gap-2 text-sm text-slate-300"><label htmlFor="returns-type">Request type</label><select id="returns-type" value={type} onChange={(event) => setType(event.target.value as ReturnTypeKey | "")} className={cn(adminInputClass, "min-h-11 min-w-0 border-white/20 bg-[#101a30]")}><option value="">All types</option><option value="REFUND">Refund</option><option value="EXCHANGE">Exchange</option></select></div>
      </div>
      {chips.length > 0 && <div role="group" aria-label="Active filters" className="flex flex-wrap gap-2">{chips.map((chip) => <button type="button" key={chip.key} onClick={chip.clear} aria-label={`Remove filter ${chip.label}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-left text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="min-w-0 break-all">{chip.label}</span><X aria-hidden className="size-4 shrink-0" /></button>)}</div>}
    </fieldset>

    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
      <p role="status" aria-live="polite">{returns.loading ? "Loading your returns queue…" : searchPending ? "Searching…" : `Showing ${returns.rows.length} of ${returns.total} ${hasFilters ? "matching " : ""}requests`}</p>
      <p>{returns.refreshing && !returns.loading ? <span className="inline-flex items-center gap-2"><Loader2 aria-hidden className="size-4 animate-spin" />Updating list…</span> : returns.updatedAt ? `Updated ${new Date(returns.updatedAt).toLocaleTimeString()}` : ""}</p>
    </div>

    <div aria-busy={returns.loading || returns.refreshing || busy}>
      {returns.loading ? <ReturnsSkeleton /> : returns.rows.length > 0 ? mobile ? <MobileReturnsList rows={returns.rows} onReview={review} disabled={busy || returns.offline || searchPending || returns.refreshing} /> : <ReturnsTable rows={returns.rows} onReview={review} disabled={busy || returns.offline || searchPending || returns.refreshing} /> : !returns.error && <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/20 bg-[#0B1224] px-4 py-12 text-center">
        <div aria-hidden className="mb-5 grid size-24 place-items-center rounded-full border border-primary/20 bg-primary/10"><PackageOpen className="size-12 text-primary" strokeWidth={1.3} /></div>
        <h3 className="text-xl font-semibold text-slate-50">{hasFilters ? "No requests match your filters" : "No return requests yet"}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">{hasFilters ? "Try a different customer, date or status, or clear the filters to see your full queue." : "When customers request returns or exchanges, they'll appear here."}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">{hasFilters && <Button type="button" onClick={clearFilters} className="min-h-11">Clear all filters</Button>}<Link href="/returns" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">View return policy</Link></div>
      </div>}
    </div>

    {returns.nextCursor && <div className="flex flex-col items-center gap-2"><Button type="button" variant="outline" onClick={() => void returns.loadMore()} disabled={returns.loadingMore || returns.refreshing || returns.offline || busy || searchPending} className={cn(outline, "min-w-40")}>{returns.loadingMore && <Loader2 aria-hidden className="size-4 animate-spin" />}{returns.loadingMore ? "Loading more…" : "Load 20 more"}</Button><p className="text-sm text-slate-300">Lists are virtualized after 40 loaded requests.</p></div>}
    <p className="text-sm text-slate-400 sm:hidden">Pull down from the top to refresh, or use the gold refresh button.</p>
    <Button type="button" disabled={refreshDisabled} onClick={() => void returns.refresh()} aria-label="Refresh returns" aria-keyshortcuts="R" className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full bg-primary p-0 text-primary-foreground shadow-[0_4px_24px_#0008] sm:hidden"><RefreshCw aria-hidden className={cn("size-6", returns.refreshing && "animate-spin")} /></Button>
    <ReturnReviewDialog target={target} onChange={setTarget} onConfirm={returns.performAction} busy={busy} offline={returns.offline} restoreFocus={restoreFocus} />
  </section>;
}
