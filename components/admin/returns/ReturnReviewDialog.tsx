"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, ImageOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminInputClass } from "@/components/admin/Field";
import { cn } from "@/lib/utils";
import { returnReference, type ReturnAction, type ReturnActionInput } from "@/lib/admin-returns";
import { ReturnStatusBadge } from "./ReturnStatusBadge";
import type { ReturnRequestRecord } from "@/types";

export interface ReturnReviewTarget { request: ReturnRequestRecord; action?: ReturnAction }

function EvidenceImage({ src, itemName, index }: { src: string; itemName: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const safe = /^(https?:\/\/|\/(?!\/))/.test(src);
  if (failed || !safe) return <div role="img" aria-label={`Evidence image ${index + 1} unavailable`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-center text-sm text-slate-300"><ImageOff aria-hidden className="size-7" />Image unavailable</div>;
  return <a href={src} target="_blank" rel="noreferrer noopener" aria-label={`Open evidence image ${index + 1} for ${itemName} in a new tab`} className="relative overflow-hidden rounded-xl border border-white/15 focus-visible:outline-2 focus-visible:outline-primary">
    <Image src={src} alt={`Customer evidence ${index + 1} for ${itemName}`} width={400} height={400} unoptimized loading="lazy" onError={() => setFailed(true)} className="aspect-square w-full object-cover" />
    <span aria-hidden className="absolute right-2 bottom-2 rounded-full bg-black/80 p-2 text-white"><ExternalLink className="size-4" /></span>
  </a>;
}

export function ReturnReviewDialog({ target, onChange, onConfirm, busy, offline, restoreFocus }: {
  target: ReturnReviewTarget | null; onChange: (target: ReturnReviewTarget | null) => void;
  onConfirm: (item: ReturnRequestRecord, input: ReturnActionInput) => Promise<boolean>;
  busy: boolean; offline: boolean; restoreFocus: () => void;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [restock, setRestock] = useState(false);
  const [validationError, setValidationError] = useState("");
  useEffect(() => {
    setAdminNote(target?.request.adminNote ?? "");
    setRestock(false);
    setValidationError("");
  }, [target?.request.id, target?.action, target?.request.adminNote]);
  const submit = async () => {
    if (!target?.action || busy || offline) return;
    if (target.action === "reject" && adminNote.trim().length < 5) { setValidationError("Add a rejection note of at least 5 characters."); return; }
    if (await onConfirm(target.request, { action: target.action, ...(target.action === "approve" ? { restock } : {}), ...(target.action === "reject" ? { adminNote: adminNote.trim() } : {}) })) onChange(null);
  };
  const item = target?.request;
  const action = target?.action;
  return <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !busy) onChange(null); }}>
    <DialogContent showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-white/15 bg-[#0B1224] p-4 text-sm text-slate-100 sm:max-w-2xl sm:p-6">
      {item && <>
        <DialogClose asChild><Button type="button" variant="ghost" aria-label="Close return review" disabled={busy} className="absolute top-2 right-2 size-11 p-0 text-slate-200 hover:bg-white/10 hover:text-white"><X aria-hidden className="size-5" /></Button></DialogClose>
        <DialogHeader className="pr-10 text-left">
          <DialogTitle className="break-all text-lg leading-snug">{action === "approve" ? "Approve return" : action === "reject" ? "Reject return" : action === "complete" ? "Complete return" : "Return details"} {returnReference(item.id)}</DialogTitle>
          <DialogDescription className="text-sm text-slate-300">{action ? "Review the details and confirm your decision. The customer’s return status will be updated." : "Review the item, evidence and customer information before taking action."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3"><ReturnStatusBadge status={item.status} /><span className="break-all text-slate-300">Order #{item.orderNumber}</span></div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <section className="min-w-0 space-y-1 rounded-xl border border-white/15 bg-white/[0.02] p-3">
            <h2 className="mb-2 text-sm font-semibold text-primary">Customer</h2>
            <p className="break-words">{item.customerName}</p><p className="break-all text-slate-300">{item.customerEmail}</p><p className="break-all text-slate-300">{item.customerPhone || "No phone on file"}</p>
          </section>
          <section className="min-w-0 space-y-1 rounded-xl border border-white/15 bg-white/[0.02] p-3">
            <h2 className="mb-2 text-sm font-semibold text-primary">{item.type === "EXCHANGE" ? "Exchange" : "Refund"} details</h2>
            <p className="break-words">{item.itemName} ×{item.quantity}</p><p className="break-words text-slate-300">{item.itemColor} / {item.itemSize}</p>
            <p className="break-words">{item.reason}</p>
            {item.details && <p className="whitespace-pre-wrap break-words text-slate-300">{item.details}</p>}
            {(item.requestedSize || item.requestedColor) && <p className="break-words text-primary">Requested: {item.requestedSize || "same size"} / {item.requestedColor || "same color"}</p>}
          </section>
        </div>
        {!action && <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Customer evidence</h2>
          {item.images.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{item.images.map((src, index) => <EvidenceImage key={`${src}-${index}`} src={src} itemName={item.itemName} index={index} />)}</div> : <p className="text-slate-300">No evidence images attached.</p>}
        </section>}
        {action === "approve" && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-white/15 p-3">
          <input type="checkbox" checked={restock} disabled={busy} onChange={(e) => setRestock(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
          <span>Restock item now<span className="mt-1 block text-slate-300">Only select this if the item has already been received and checked. Approval alone does not require restocking.</span></span>
        </label>}
        {action === "reject" && <div>
          <label htmlFor="return-rejection-note" className="mb-2 block text-sm font-medium">Reason for rejection <span className="text-rose-200">(required)</span></label>
          <textarea id="return-rejection-note" value={adminNote} onChange={(e) => { setAdminNote(e.target.value); setValidationError(""); }} disabled={busy} aria-invalid={Boolean(validationError)} aria-describedby="return-note-help" maxLength={1000} rows={3} className={cn(adminInputClass, "h-auto min-h-24 py-3 text-sm")} placeholder="Explain the decision to the customer" />
          <p id="return-note-help" className={cn("mt-2 text-sm", validationError ? "text-rose-200" : "text-slate-300")}>{validationError || "Use 5–1,000 characters. This note is visible to the customer."}</p>
        </div>}
        {item.adminNote && !action && <p className="whitespace-pre-wrap break-words rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-rose-200">Admin note: {item.adminNote}</p>}
        {offline && <p role="status" className="text-amber-200">You are offline. Reconnect before confirming a decision.</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onChange(null)} className="min-h-11 border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white">Cancel</Button>
          {!action && item.status === "PENDING" && <>
            <Button type="button" variant="outline" disabled={busy || offline} onClick={() => onChange({ request: item, action: "reject" })} className="min-h-11 border-rose-300/30 bg-rose-300/5 text-rose-200 hover:bg-rose-300/15 hover:text-rose-100">Reject request</Button>
            <Button type="button" disabled={busy || offline} onClick={() => onChange({ request: item, action: "approve" })} className="min-h-11">Approve request</Button>
          </>}
          {!action && (item.status === "APPROVED" || item.status === "RECEIVED") && <Button type="button" disabled={busy || offline} onClick={() => onChange({ request: item, action: "complete" })} className="min-h-11">Mark completed</Button>}
          {action && <Button type="button" disabled={busy || offline} onClick={() => void submit()} className={cn("min-h-11", action === "reject" && "bg-rose-200 text-[#0B1224] hover:bg-rose-100")}>{busy && <Loader2 aria-hidden className="size-4 animate-spin" />}{busy ? "Saving decision…" : action === "approve" ? "Confirm approval" : action === "reject" ? "Confirm rejection" : "Confirm completion"}</Button>}
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
