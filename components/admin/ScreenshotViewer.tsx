"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ZoomIn, Check, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguageStore } from "@/store/useLanguageStore";

interface ScreenshotViewerProps {
  screenshotUrl?: string | null;
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  onApprove?: () => void;
  onReject?: () => void;
  isVerifying?: boolean;
}

export function ScreenshotViewer({
  screenshotUrl,
  isOpen,
  onClose,
  orderNumber,
  onApprove,
  onReject,
  isVerifying = false,
}: ScreenshotViewerProps) {
  const language = useLanguageStore((state) => state.language);
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsLoading(true);
    try {
      await onApprove();
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsLoading(true);
    try {
      await onReject();
    } finally {
      setIsLoading(false);
    }
  };

  const screenshotTitle = language === "bn" ? "পেমেন্ট স্ক্রিনশট" : "Payment Screenshot";
  const orderRefText = language === "bn" ? "অর্ডার রেফারেন্স:" : "Order Reference:";
  const closeText = language === "bn" ? "বন্ধ করুন" : "Close";
  const verifyPaymentText = language === "bn" ? "পেমেন্ট যাচাইকরণ" : "Verify Payment";
  const approveText = language === "bn" ? "অনুমোদন করুন" : "Approve";
  const rejectText = language === "bn" ? "প্রত্যাখ্যান করুন" : "Reject";
  const processingText = language === "bn" ? "প্রক্রিয়াকরণ..." : "Processing...";
  const noScreenshotText = language === "bn" ? "কোনো স্ক্রিনশট নেই" : "No screenshot available";
  const instructionsText =
    language === "bn"
      ? "দয়া করে স্ক্রিনশটটি যাচাই করুন এবং পেমেন্টের পরিমাণ ও রেফারেন্স নম্বর পেয়েছেন কিনা তা নিশ্চিত করুন।"
      : "Please verify the screenshot and confirm the payment amount and reference number match.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isVerifying ? (
              <>
                <RefreshCw className={cn("size-5 animate-spin", isLoading && "text-primary")} />
                {processingText}
              </>
            ) : (
              <>
                <ZoomIn className="size-5 text-primary" />
                {verifyPaymentText}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Order reference */}
          <div className="flex items-center justify-between rounded-lg border border-glass-border bg-[#141414] px-4 py-2">
            <span className="text-sm text-muted-foreground">{orderRefText}</span>
            <span className="font-mono text-sm text-primary">{orderNumber}</span>
          </div>

          {/* Screenshot display */}
          {screenshotUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-glass-border bg-gray-900">
              <Image
                src={screenshotUrl}
                alt={screenshotTitle}
                width={800}
                height={600}
                className="object-contain max-h-[400px]"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 rounded-full bg-primary/20 px-4 py-2">
                    <RefreshCw className="size-4 animate-spin text-primary" />
                    <span className="text-sm font-medium text-primary">{processingText}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-glass-border bg-[#141414] py-12">
              <div className="rounded-full bg-glass-border p-4">
                <Image
                  src="/icons/image.svg"
                  alt={noScreenshotText}
                  width={48}
                  height={48}
                  className="text-muted-foreground"
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{noScreenshotText}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-xl border border-glass-border bg-glass p-4">
            <p className="text-sm text-muted-foreground">{instructionsText}</p>
          </div>

          {/* Actions */}
          {!isVerifying && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleReject}
                className="flex-1 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/10"
              >
                <XCircle className="mr-2 size-4 text-rose" />
                {rejectText}
              </Button>
              <Button
                onClick={handleApprove}
                className="flex-1 bg-emerald-500 hover:bg-emerald-500/90"
              >
                <Check className="mr-2 size-4 text-white" />
                {approveText}
              </Button>
            </div>
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full"
          >
            <X className="mr-2 size-4" />
            {closeText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
