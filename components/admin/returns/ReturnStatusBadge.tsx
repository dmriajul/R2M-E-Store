import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isUrgentReturn } from "@/lib/admin-returns";
import type { ReturnRequestRecord, ReturnStatusKey } from "@/types";

const STYLE: Record<ReturnStatusKey, string> = {
  PENDING: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  APPROVED: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  REJECTED: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  RECEIVED: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  COMPLETED: "border-slate-300/30 bg-slate-300/10 text-slate-200",
};
export function ReturnStatusBadge({ status }: { status: ReturnStatusKey }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-medium", STYLE[status])}>
    {status === "PENDING" && <span aria-hidden className="size-1.5 rounded-full bg-amber-200 motion-safe:animate-pulse" />}
    {status.charAt(0) + status.slice(1).toLowerCase()}
  </span>;
}
export function ReturnUrgency({ item }: { item: ReturnRequestRecord }) {
  if (!isUrgentReturn(item)) return null;
  return <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-200"><AlertTriangle aria-hidden className="size-4" />Urgent<span className="sr-only">: pending for more than 3 days</span></span>;
}
