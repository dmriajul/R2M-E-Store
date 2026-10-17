"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthFeedback({ message, warning, onDismiss }: { message: string | null; warning: boolean; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", warning ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-rose-400/30 bg-rose-400/10 text-rose-300")}>
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
