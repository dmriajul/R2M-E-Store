import { Check, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { returnReference, type ReturnAction } from "@/lib/admin-returns";
import type { ReturnRequestRecord } from "@/types";

export type ReturnReviewHandler = (item: ReturnRequestRecord, action?: ReturnAction) => void;
export function ReturnQuickActions({ item, onReview, disabled, compact = false }: { item: ReturnRequestRecord; onReview: ReturnReviewHandler; disabled: boolean; compact?: boolean }) {
  const reference = returnReference(item.id);
  return <div className="relative flex items-center gap-2">
    {item.status === "PENDING" && <>
      <Button variant="outline" type="button" disabled={disabled} aria-label={`Approve ${reference}`} title="Approve return" onClick={() => onReview(item, "approve")} className={cn("min-h-11 min-w-11 border-emerald-300/30 bg-emerald-300/5 text-emerald-200 hover:bg-emerald-300/15 hover:text-emerald-100", compact ? "size-11 p-0" : "flex-1 px-3")}>
        <Check aria-hidden className={cn("size-4", !compact && "hidden min-[375px]:block")} /><span className={compact ? "sr-only" : undefined}>Approve</span>
      </Button>
      <Button variant="outline" type="button" disabled={disabled} aria-label={`Reject ${reference}`} title="Reject return" onClick={() => onReview(item, "reject")} className={cn("min-h-11 min-w-11 border-rose-300/30 bg-rose-300/5 text-rose-200 hover:bg-rose-300/15 hover:text-rose-100", compact ? "size-11 p-0" : "flex-1 px-3")}>
        <X aria-hidden className={cn("size-4", !compact && "hidden min-[375px]:block")} /><span className={compact ? "sr-only" : undefined}>Reject</span>
      </Button>
    </>}
    <Button variant="outline" type="button" disabled={disabled} aria-label={`View details for ${reference}`} title="View details" onClick={() => onReview(item)} className="size-11 shrink-0 border-white/20 bg-transparent p-0 text-slate-200 hover:bg-white/10 hover:text-white"><Eye aria-hidden className="size-4" /></Button>
  </div>;
}
