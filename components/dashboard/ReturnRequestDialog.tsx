"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Upload, X } from "lucide-react";
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
import { checkoutInputClass } from "@/components/checkout/Field";
import { cn } from "@/lib/utils";
import { RETURN_REASONS, returnRequestSchema } from "@/lib/validations";
import type { ApiResponse, CartItem, ReturnRequestRecord, ReturnStatusKey, UploadResult } from "@/types";

const STATUS_STYLE: Record<ReturnStatusKey, string> = {
  PENDING: "border-primary/35 bg-primary/12 text-primary",
  APPROVED: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
  REJECTED: "border-rose/35 bg-rose-soft text-rose",
  RECEIVED: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
  COMPLETED: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
};

const STATUS_LABEL: Record<ReturnStatusKey, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RECEIVED: "Item received",
  COMPLETED: "Completed",
};

const customerStatusMessage = (item: ReturnRequestRecord): string => {
  if (item.status === "APPROVED") return "Your request is approved. Our team will contact you with the next steps.";
  if (item.status === "REJECTED") return item.adminNote ?? "Your request was declined. Contact customer care if you need help.";
  if (item.status === "COMPLETED") return item.type === "REFUND" ? "Your refund has been processed." : "Your exchange has been dispatched.";
  if (item.status === "RECEIVED") return "We received your item and are processing your request.";
  return "Your request is waiting for review.";
};

interface ReturnRequestDialogProps {
  orderId: string;
  orderNumber: string;
  items: CartItem[];
  delivered: boolean;
}

export function ReturnRequestDialog({
  orderId,
  orderNumber,
  items,
  delivered,
}: ReturnRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [type, setType] = useState<"REFUND" | "EXCHANGE">("REFUND");
  const [reason, setReason] = useState<(typeof RETURN_REASONS)[number]>(RETURN_REASONS[0]);
  const [details, setDetails] = useState("");
  const [requestedSize, setRequestedSize] = useState("");
  const [requestedColor, setRequestedColor] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [requests, setRequests] = useState<ReturnRequestRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => items.filter((item) => item.orderItemId && selectedItems.includes(item.orderItemId)),
    [items, selectedItems],
  );
  const sizes = selected[0]?.availableSizes ?? [];
  const colors = selected[0]?.availableColors ?? [];
  const hasOrderItemIds = items.length > 0 && items.every((item) => Boolean(item.orderItemId));

  const loadRequests = useCallback(async () => {
    const response = await fetch(`/api/returns?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<ReturnRequestRecord[]>;
    if (!response.ok || !result.success) throw new Error(result.error ?? "Could not load return requests");
    setRequests(result.data ?? []);
  }, [orderId]);

  useEffect(() => {
    if (!delivered || !hasOrderItemIds) return;
    loadRequests().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not load return requests");
    });
  }, [delivered, hasOrderItemIds, loadRequests]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedItems.length === 0) {
      toast.error("Select at least one item");
      return;
    }
    const validation = returnRequestSchema.safeParse({
      orderId,
      orderItemIds: selectedItems,
      type,
      reason,
      details,
      requestedSize: type === "EXCHANGE" ? requestedSize : undefined,
      requestedColor: type === "EXCHANGE" ? requestedColor : undefined,
      images: [],
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Check your return request details");
      return;
    }
    setLoading(true);
    try {
      const imageUrls: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const upload = await fetch("/api/upload", { method: "POST", body: form });
        const uploaded = (await upload.json()) as ApiResponse<UploadResult>;
        if (!upload.ok || !uploaded.success || !uploaded.data?.url) {
          throw new Error(uploaded.error ?? `Could not upload ${file.name}`);
        }
        imageUrls.push(uploaded.data.url);
      }

      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderItemIds: selectedItems,
          type,
          reason,
          details,
          requestedSize: type === "EXCHANGE" ? requestedSize : undefined,
          requestedColor: type === "EXCHANGE" ? requestedColor : undefined,
          images: imageUrls,
        }),
      });
      const result = (await response.json()) as ApiResponse<ReturnRequestRecord[]>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Could not submit your return request");
      }
      setRequests((current) => [...result.data!, ...current]);
      setSelectedItems([]);
      setDetails("");
      setFiles([]);
      setOpen(false);
      toast.success("Request submitted", { description: "We will notify you when it has been reviewed." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your return request");
    } finally {
      setLoading(false);
    }
  };

  if (!delivered || !hasOrderItemIds) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-10 rounded-full border-primary/35 bg-primary/8 px-4 text-[11px] font-semibold tracking-[0.12em] uppercase text-primary hover:bg-primary/15"
      >
        <RotateCcw className="size-3.5" />
        Request Return / Exchange
      </Button>

      {requests.length > 0 && (
        <section aria-label="Return request status" className="w-full rounded-2xl border border-glass-border bg-white/3 p-3">
          <h3 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Return / exchange status</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-foreground">{item.itemName} · {item.type.toLowerCase()}</span>
                <span className={cn("rounded-full border px-2 py-1 font-semibold", STATUS_STYLE[item.status])}>
                  {STATUS_LABEL[item.status]}
                </span>
                <ol aria-label="Request timeline" className="flex w-full flex-wrap gap-1 text-[10px] text-muted-foreground">
                  <li className="rounded-full bg-white/5 px-2 py-1">Submitted · {new Date(item.createdAt).toLocaleDateString()}</li>
                  <li className="rounded-full bg-white/5 px-2 py-1">{STATUS_LABEL[item.status]}</li>
                </ol>
                {item.adminNote && <p className="w-full text-xs text-rose">{item.adminNote}</p>}
                <p className="w-full text-xs text-muted-foreground">{customerStatusMessage(item)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90dvh] overflow-y-auto rounded-3xl border-glass-border">
          <DialogHeader>
            <DialogTitle>Return or exchange · {orderNumber}</DialogTitle>
            <DialogDescription>Select the delivered item(s) and tell us how we can help.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Items</legend>
              {items.map((item) => {
                const id = item.orderItemId!;
                return (
                  <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-glass-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(id)}
                      onChange={(event) => setSelectedItems((current) =>
                        event.target.checked ? [...current, id] : current.filter((selectedId) => selectedId !== id),
                      )}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">{item.name} · {item.color} · {item.size} · ×{item.quantity}</span>
                  </label>
                );
              })}
            </fieldset>
            <label className="flex flex-col gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Request type
              <select value={type} onChange={(event) => setType(event.target.value as "REFUND" | "EXCHANGE")} className={cn(checkoutInputClass, "px-3 text-sm normal-case")}>
                <option value="REFUND">Refund</option>
                <option value="EXCHANGE">Exchange</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Reason
              <select value={reason} onChange={(event) => setReason(event.target.value as (typeof RETURN_REASONS)[number])} className={cn(checkoutInputClass, "px-3 text-sm normal-case")}>
                {RETURN_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            {type === "EXCHANGE" && selected.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {sizes.length > 0 && (
                  <label className="flex flex-col gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    New size
                    <select value={requestedSize} onChange={(event) => setRequestedSize(event.target.value)} className={cn(checkoutInputClass, "px-3 text-sm normal-case")}>
                      <option value="">Choose a size</option>
                      {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                )}
                {colors.length > 0 && (
                  <label className="flex flex-col gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    New color
                    <select value={requestedColor} onChange={(event) => setRequestedColor(event.target.value)} className={cn(checkoutInputClass, "px-3 text-sm normal-case")}>
                      <option value="">Choose a color</option>
                      {colors.map((color) => <option key={color} value={color}>{color}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}
            <label className="flex flex-col gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Details (optional)
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} maxLength={1000} className={cn(checkoutInputClass, "h-auto min-h-20 px-3 py-3 text-sm normal-case")} />
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-glass-border p-3 text-sm text-muted-foreground">
              <Upload className="size-4 text-primary" />
              <span className="flex-1">Upload proof images (up to 5, 5 MB each)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files ?? []);
                  if (selectedFiles.length > 5) {
                    toast.error("Choose no more than 5 images");
                    return;
                  }
                  setFiles(selectedFiles);
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {files.map((file) => <li key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2"><span className="flex-1 truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((candidate) => candidate !== file))}><X className="size-3.5" /></button></li>)}
              </ul>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
              <Button
                type="submit"
                disabled={loading || selectedItems.length === 0 || (type === "EXCHANGE" && !requestedSize && !requestedColor)}
                className="rounded-full bg-primary text-primary-foreground"
              >
                {loading ? "Submitting…" : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
