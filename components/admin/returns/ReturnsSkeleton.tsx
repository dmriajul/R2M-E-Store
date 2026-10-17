import { cn } from "@/lib/utils";
import styles from "./ReturnsSkeleton.module.css";

export function ReturnsSkeleton() {
  return <div role="status" aria-label="Loading return requests" data-testid="returns-skeleton">
    <span className="sr-only">Loading return requests…</span>
    <div aria-hidden className="space-y-3 sm:hidden">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-4 rounded-2xl border border-white/15 bg-[#0B1224] p-4"><div className={cn(styles.shimmer, "h-5 w-3/4 rounded")} /><div className={cn(styles.shimmer, "h-7 w-24 rounded-full")} /><div className={cn(styles.shimmer, "h-4 w-1/2 rounded")} /><div className={cn(styles.shimmer, "h-11 rounded-lg")} /></div>)}</div>
    <div aria-hidden className="hidden overflow-hidden rounded-2xl border border-white/15 bg-[#0B1224] sm:block"><div className="h-14 bg-white/5" />{Array.from({ length: 6 }, (_, i) => <div key={i} className="grid h-24 grid-cols-6 items-center gap-4 border-t border-white/10 px-4">{Array.from({ length: 6 }, (_, j) => <div key={j} className={cn(styles.shimmer, "h-4 rounded")} />)}</div>)}</div>
  </div>;
}
