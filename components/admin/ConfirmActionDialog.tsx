"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminButtonBlue, adminButtonGhost } from "@/components/admin/Field";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red and swaps the icon for a warning. */
  destructive?: boolean;
  onConfirm: () => void;
}

/** Console-styled confirmation modal for destructive or bulk actions. */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2A2A2A] bg-[#141414] p-6">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <DialogHeader className="gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-9 place-items-center rounded-lg border",
                    destructive
                      ? "border-rose-500/35 bg-rose-500/12 text-rose-400"
                      : "border-blue-500/35 bg-blue-500/12 text-blue-400",
                  )}
                >
                  <AlertTriangle className="size-4" />
                </span>
                <DialogTitle className="text-sm font-semibold text-foreground">{title}</DialogTitle>
                {description && (
                  <DialogDescription className="text-xs text-muted-foreground">
                    {description}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={cn(adminButtonGhost, "min-h-11 sm:min-h-10")}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onOpenChange(false);
                  }}
                  className={cn(
                    adminButtonBlue,
                    "min-h-11 sm:min-h-10",
                    destructive && "bg-rose-500 text-white hover:bg-rose-400",
                  )}
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
