"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import { returnReference } from "@/lib/admin-returns";
import { ReturnStatusBadge, ReturnUrgency } from "./ReturnStatusBadge";
import { ReturnQuickActions, type ReturnReviewHandler } from "./ReturnQuickActions";
import type { ReturnRequestRecord } from "@/types";

interface ListProps { rows: ReturnRequestRecord[]; onReview: ReturnReviewHandler; disabled: boolean }

function ReturnCard({ item, onReview, disabled, expanded, onToggle }: ListProps & { item: ReturnRequestRecord; expanded: boolean; onToggle: () => void }) {
  return <article data-testid="return-card" className="overflow-hidden rounded-2xl border border-white/15 bg-[#0B1224] text-sm text-slate-100 shadow-sm">
    <button type="button" aria-expanded={expanded} aria-controls={`return-card-${item.id}`} aria-label={`${expanded ? "Collapse" : "Expand"} ${returnReference(item.id)}`} onClick={onToggle} className="flex min-h-11 w-full flex-col gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
      <span className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 break-all text-base font-semibold text-slate-50">{returnReference(item.id)}</span>
        <ChevronDown aria-hidden className={cn("mt-1 size-5 shrink-0 text-slate-300 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
      </span>
      <span className="flex w-full flex-wrap items-center gap-2"><ReturnStatusBadge status={item.status} /><ReturnUrgency item={item} /></span>
      <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-medium">{item.customerName}</span>
        <time dateTime={item.createdAt} className="text-slate-300">{formatShortDate(item.createdAt)}</time>
      </span>
      <span className="break-all text-slate-300">Order #{item.orderNumber}</span>
      <span className="text-primary">{expanded ? "Hide item details" : "Tap to see item & reason"}</span>
    </button>
    <div id={`return-card-${item.id}`} hidden={!expanded} className="space-y-3 border-t border-white/10 px-4 py-3">
      <p className="break-words font-medium">{item.itemName} <span className="text-slate-300">×{item.quantity}</span></p>
      <p className="break-words text-slate-300">{item.type === "EXCHANGE" ? "Exchange" : "Refund"} · {item.itemColor} / {item.itemSize}</p>
      <p className="break-words"><span className="text-slate-300">Reason: </span>{item.reason}</p>
      {item.details && <p className="whitespace-pre-wrap break-words text-slate-300">{item.details}</p>}
    </div>
    <div className="border-t border-white/10 p-3"><ReturnQuickActions item={item} onReview={onReview} disabled={disabled} /></div>
  </article>;
}

export function MobileReturnsList(props: ListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scrollMargin, setScrollMargin] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const virtual = props.rows.length > 40;
  const virtualizer = useWindowVirtualizer({ count: props.rows.length, estimateSize: () => 310, overscan: 4, scrollMargin, enabled: virtual });
  useLayoutEffect(() => {
    if (!virtual) return;
    // Dynamic-height window virtualization must not inherit the storefront's
    // smooth programmatic scrolling: measurement corrections otherwise fight
    // the animation and can prevent reaching earlier cards.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    return () => { root.style.scrollBehavior = previous; };
  }, [virtual]);
  useLayoutEffect(() => {
    const measure = () => setScrollMargin((root.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current?.parentElement) observer.observe(root.current.parentElement);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const visible = virtual ? virtualizer.getVirtualItems() : props.rows.map((row, index) => ({ index, key: row.id, start: 0 }));
  return <div ref={root} data-testid="mobile-returns" role="list" aria-label="Return requests" className={cn("relative", !virtual && "space-y-3")} style={virtual ? { height: virtualizer.getTotalSize() } : undefined}>
    {visible.map((row) => {
      const item = props.rows[row.index]!;
      return <div key={item.id} ref={virtual ? virtualizer.measureElement : undefined} data-index={row.index} role="listitem" aria-posinset={row.index + 1} aria-setsize={props.rows.length} style={virtual ? { position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start - scrollMargin}px)`, paddingBottom: 12 } : undefined}>
        <ReturnCard {...props} item={item} expanded={expanded.has(item.id)} onToggle={() => setExpanded((previous) => { const next = new Set(previous); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} />
      </div>;
    })}
  </div>;
}

export function ReturnsTable({ rows, onReview, disabled }: ListProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const virtual = rows.length > 40;
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scroll.current, estimateSize: () => 112, overscan: 5, enabled: virtual });
  const firstId = rows[0]?.id;
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [firstId]);
  const visible = virtual ? virtualizer.getVirtualItems() : rows.map((row, index) => ({ index, key: row.id, start: 0, end: 0 }));
  const top = virtual ? visible[0]?.start ?? 0 : 0;
  const bottom = virtual ? Math.max(0, virtualizer.getTotalSize() - (visible.at(-1)?.end ?? 0)) : 0;
  return <div ref={scroll} data-testid="returns-table-scroll" tabIndex={0} role="region" aria-label="Return requests table; scroll for more columns or rows" className="max-h-[70dvh] w-full overflow-auto rounded-2xl border border-white/15 outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <table aria-label="Return requests" aria-rowcount={rows.length + 1} className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left text-sm lg:min-w-0">
      <thead className="sticky top-0 z-20 bg-[#172139] text-slate-200">
        <tr className="h-14">
          <th scope="col" className="sticky left-0 z-30 w-[18%] bg-[#172139] px-3 py-3 font-medium">Request / date</th>
          <th scope="col" className="w-[17%] px-3 py-3 font-medium">Customer</th>
          <th scope="col" className="w-[20%] px-3 py-3 font-medium">Item / type</th>
          <th scope="col" className="w-[16%] px-3 py-3 font-medium">Reason</th>
          <th scope="col" className="w-[14%] px-2 py-3 font-medium">Status</th>
          <th scope="col" className="w-[15%] px-2 py-3 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {top > 0 && <tr aria-hidden><td colSpan={6} style={{ height: top, padding: 0 }} /></tr>}
        {visible.map((entry) => {
          const item = rows[entry.index]!;
          return <tr key={item.id} data-index={entry.index} ref={virtual ? virtualizer.measureElement : undefined} aria-rowindex={entry.index + 2} className="group h-20 bg-[#0B1224] text-slate-100 transition-colors hover:bg-[#152039]">
            <th scope="row" className="sticky left-0 z-10 border-t border-white/10 bg-[#0B1224] px-3 py-4 text-left font-normal shadow-[2px_0_5px_0_#0002] group-hover:bg-[#152039]">
              <span className="block break-all font-semibold text-slate-50">{returnReference(item.id)}</span>
              <span className="mt-1 block break-all text-slate-300">Order #{item.orderNumber}</span>
              <time dateTime={item.createdAt} className="mt-1 block text-slate-300">{formatShortDate(item.createdAt)}</time>
            </th>
            <td className="border-t border-white/10 px-3 py-4 align-top"><span className="block break-words font-medium">{item.customerName}</span><span className="mt-1 block break-all text-slate-300">{item.customerEmail}</span></td>
            <td className="border-t border-white/10 px-3 py-4 align-top"><span className="block break-words">{item.itemName} ×{item.quantity}</span><span className="mt-1 block break-words text-slate-300">{item.type === "EXCHANGE" ? "Exchange" : "Refund"} · {item.itemColor} / {item.itemSize}</span></td>
            <td className="break-words border-t border-white/10 px-3 py-4 align-top">{item.reason}</td>
            <td className="border-t border-white/10 px-2 py-4 align-top"><div className="flex flex-col items-start gap-2"><ReturnStatusBadge status={item.status} /><ReturnUrgency item={item} /></div></td>
            <td className="border-t border-white/10 px-2 py-4 align-top"><div className="[&>div]:flex-wrap"><ReturnQuickActions item={item} onReview={onReview} disabled={disabled} compact /></div></td>
          </tr>;
        })}
        {bottom > 0 && <tr aria-hidden><td colSpan={6} style={{ height: bottom, padding: 0 }} /></tr>}
      </tbody>
    </table>
  </div>;
}
