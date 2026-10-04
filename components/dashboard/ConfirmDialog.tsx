"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the confirm button stays locked until this is typed back. */
  confirmPhrase?: string;
  onConfirm: () => void;
}

/** Shared confirmation modal — used by the address book and the danger zone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  confirmPhrase,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const locked =
    Boolean(confirmPhrase) &&
    typed.trim().toUpperCase() !== (confirmPhrase ?? "").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md rounded-3xl border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && (
            <DialogDescription className="prose-kids">{description}</DialogDescription>
          )}
        </DialogHeader>

        {confirmPhrase && (
          <label className="flex flex-col gap-2 text-xs text-muted-foreground">
            Type <span className="font-semibold text-foreground">{confirmPhrase}</span> to confirm
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className={cn(checkoutInputClass, "h-11 px-3 tracking-[0.3em] uppercase")}
              aria-label={`Type ${confirmPhrase} to confirm`}
              autoComplete="off"
            />
          </label>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={locked}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={cn(
              "h-11 rounded-full text-xs font-semibold tracking-[0.14em] uppercase transition-all duration-500",
              destructive
                ? "bg-rose/90 text-white hover:bg-rose hover:shadow-[0_0_28px_-8px_rgba(244,63,94,0.9)]"
                : "bg-primary text-primary-foreground hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.9)]",
            )}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
