"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminInputClass } from "@/components/admin/Field";
import { cn, formatShortDate } from "@/lib/utils";
import type { ApiResponse, ReturnRequestRecord, ReturnStatusKey } from "@/types";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

const FILTERS: Filter[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "COMPLETED"];
const STATUS_STYLE: Record<ReturnStatusKey, string> = {
  PENDING: "border-primary/35 bg-primary/12 text-primary",
  APPROVED: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
  REJECTED: "border-rose-400/30 bg-rose-400/12 text-rose-300",
  RECEIVED: "border-sky-400/30 bg-sky-400/12 text-sky-300",
  COMPLETED: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
};

export default function AdminReturnsPage() {
  const [requests, setRequests] = useState<ReturnRequestRecord[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<ReturnRequestRecord | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [restock, setRestock] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    const query = filter === "ALL" ? "" : `?status=${filter}`;
    const response = await fetch(`/api/admin/returns${query}`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<ReturnRequestRecord[]>;
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "Could not load return requests");
    }
    setRequests(result.data);
  }, [filter]);

  useEffect(() => {
    loadRequests().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not load return requests");
    });
  }, [loadRequests]);

  const visibleRequests = requests;

  const performAction = async (action: "approve" | "reject" | "complete") => {
    if (!selected) return;
    if (action === "reject" && adminNote.trim().length < 5) {
      toast.error("Add a rejection note of at least 5 characters");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? { action, restock }
            : action === "reject"
              ? { action, adminNote }
              : { action },
        ),
      });
      const result = (await response.json()) as ApiResponse<{
        request: ReturnRequestRecord;
        notification: string;
      }>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Could not update return request");
      }
      toast.success("Request updated", { description: result.data.notification });
      window.dispatchEvent(new Event("mukra:returns-updated"));
      setSelected(null);
      setAdminNote("");
      setRestock(false);
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update return request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl bg-[#050816] p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Customer care</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Returns &amp; Exchanges</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review requests, customer evidence and inventory options.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => loadRequests().catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not refresh requests"))} className="rounded-full border-[#303030]">
          <RotateCcw className="size-4" /> Refresh
        </Button>
      </header>

      <div role="tablist" aria-label="Filter return requests" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.1em] transition-colors",
              filter === item
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-[#2A2A2A] bg-[#141414] text-muted-foreground hover:text-foreground",
            )}
          >
            {item === "ALL" ? "All requests" : item}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#1D2642] bg-[#080D20]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Request</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Item / type</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Review</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((item) => (
              <tr key={item.id} className="border-t border-[#232323] text-foreground">
                <td className="px-4 py-3 font-medium">#{item.orderNumber}</td>
                <td className="px-4 py-3">
                  <span className="block">{item.customerName}</span>
                  <span className="text-xs text-muted-foreground">{item.customerEmail}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{item.itemName}</span>
                  <span className="text-xs text-muted-foreground">{item.type} · {item.itemColor} / {item.itemSize}</span>
                </td>
                <td className="px-4 py-3">{item.reason}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[item.status])}>{item.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatShortDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setSelected(item); setAdminNote(item.adminNote ?? ""); }} className="rounded-full border-[#333]">
                    Review
                  </Button>
                </td>
              </tr>
            ))}
            {visibleRequests.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No return requests in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !loading) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto border-[#1D2642] bg-[#050816] text-foreground">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Review request · {selected.orderNumber}</DialogTitle>
                <DialogDescription className="text-muted-foreground">Confirm the returned item, customer details, evidence and exchange preference.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-[#292929] bg-white/[0.02] p-4 text-sm">
                  <h2 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Customer</h2>
                  <p>{selected.customerName}</p>
                  <p className="text-muted-foreground">{selected.customerEmail}</p>
                  <p className="text-muted-foreground">{selected.customerPhone || "No phone on file"}</p>
                </section>
                <section className="rounded-xl border border-[#292929] bg-white/[0.02] p-4 text-sm">
                  <h2 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Request</h2>
                  <p>{selected.itemName} · ×{selected.quantity}</p>
                  <p className="text-muted-foreground">{selected.itemColor} / {selected.itemSize} · {selected.type}</p>
                  <p className="mt-2">{selected.reason}</p>
                  {selected.details && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.details}</p>}
                  {(selected.requestedSize || selected.requestedColor) && (
                    <p className="mt-2 text-primary">Requested: {selected.requestedSize || "same size"} / {selected.requestedColor || "same color"}</p>
                  )}
                </section>
              </div>
              <section>
                <h2 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Proof images</h2>
                {selected.images.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selected.images.map((image) => (
                      <a key={image} href={image} target="_blank" rel="noreferrer noopener" className="group relative overflow-hidden rounded-xl border border-[#303030]">
                        <Image src={image} alt={`Proof for ${selected.itemName}`} width={500} height={500} unoptimized className="aspect-square w-full object-cover" />
                        <span className="absolute right-2 bottom-2 rounded-full bg-black/75 p-2 text-white"><ExternalLink className="size-3" /></span>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No proof images attached.</p>}
              </section>
              {selected.status === "PENDING" && (
                <>
                  <label className="flex items-center gap-3 rounded-xl border border-[#292929] p-3 text-sm text-muted-foreground">
                    <input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} className="size-4 accent-[var(--primary)]" />
                    Automatically Restock Item to Inventory
                  </label>
                  <label className="flex flex-col gap-2 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Rejection note (required to reject)
                    <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} maxLength={1000} rows={3} className={cn(adminInputClass, "h-auto py-3")} placeholder="Explain why this request is being rejected" />
                  </label>
                </>
              )}
              {selected.adminNote && selected.status !== "PENDING" && (
                <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200">Admin note: {selected.adminNote}</p>
              )}
              <DialogFooter className="gap-2">
                {selected.status === "PENDING" && (
                  <>
                    <Button type="button" variant="outline" disabled={loading} onClick={() => performAction("reject")} className="rounded-full border-rose-400/30 text-rose-300">Reject Request</Button>
                    <Button type="button" disabled={loading} onClick={() => performAction("approve")} className="rounded-full bg-primary text-primary-foreground">Approve Request</Button>
                  </>
                )}
                {(selected.status === "APPROVED" || selected.status === "RECEIVED") && (
                  <Button type="button" disabled={loading} onClick={() => performAction("complete")} className="rounded-full bg-primary text-primary-foreground">Mark Completed</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
