"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ClipboardCopy,
  ImagePlus,
  Info,
  Loader2,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/config";
import { paymentSchema, type PaymentValues } from "@/lib/validations";
import { computeTotals } from "@/lib/cart";
import { isManualPayment, PAYMENT_METHODS } from "@/lib/payments";
import { humanFileSize } from "@/lib/images";
import { useCartStore } from "@/store/useCartStore";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { Field, checkoutInputClass } from "@/components/checkout/Field";
import {
  CopyableValue,
  PaymentMethodPicker,
  PaymentSecurityNote,
} from "@/components/checkout/PaymentMethodPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentKey, UploadResult } from "@/types";

/** Screenshots are capped at 2MB; product images get 5MB in the admin console. */
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

/** Step 3 — payment method, manual-transfer details and the final "Place Order". */
export function StepPayment() {
  const payment = useCheckoutStore((state) => state.payment);
  const contact = useCheckoutStore((state) => state.contact);
  const shipping = useCheckoutStore((state) => state.shipping);
  const coupon = useCheckoutStore((state) => state.coupon);
  const setPayment = useCheckoutStore((state) => state.setPayment);
  const placeOrder = useCheckoutStore((state) => state.placeOrder);
  const goBack = useCheckoutStore((state) => state.goBack);

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const [placing, setPlacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const totals = computeTotals(items, {
    method: shipping?.method ?? "standard",
    giftWrap: shipping?.giftWrap ?? false,
    coupon,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    mode: "onChange",
    defaultValues: payment ?? {
      method: "COD",
      senderNumber: "",
      screenshotUrl: "",
      transactionId: "",
      confirmed: false,
    },
  });

  const method = watch("method") as PaymentKey;
  const screenshotUrl = watch("screenshotUrl") ?? "";
  const confirmed = watch("confirmed");
  const config = PAYMENT_METHODS[method] ?? PAYMENT_METHODS.COD;
  const manual = isManualPayment(method);

  /** Uploads the proof-of-payment screenshot and stores its URL on the form. */
  const handleScreenshot = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Upload a PNG, JPEG or WebP screenshot");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error(`Screenshots must be under ${humanFileSize(MAX_SCREENSHOT_BYTES)}`);
      return;
    }

    setLocalPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "little-luxe/payments");

      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = (await response.json()) as { data?: UploadResult; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setValue("screenshotUrl", payload.data.url, { shouldValidate: true });
      toast.success("Screenshot uploaded 📎", {
        description: `Stored via ${payload.data.provider === "cloudinary" ? "Cloudinary" : "local demo storage"}.`,
      });
    } catch (error) {
      setValue("screenshotUrl", "", { shouldValidate: true });
      setLocalPreview(null);
      toast.error("Couldn't upload that screenshot", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: PaymentValues) => {
    setPlacing(true);
    setPayment(values);

    const fallbackNumber = `LL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    let orderNumber = fallbackNumber;
    let persistedId: string | undefined;

    /* Persist the order — the API answers from Postgres, or from the demo log. */
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
          })),
          contact: {
            name: shipping?.fullName ?? "Guest shopper",
            email: contact?.email ?? "",
            phone: contact?.phone ?? "",
          },
          shipping: {
            address: [shipping?.address1, shipping?.address2].filter(Boolean).join(", "),
            city: shipping?.city ?? "",
            zip: shipping?.postalCode ?? "",
            country: shipping?.country ?? "Bangladesh",
            method: shipping?.method ?? "standard",
            giftWrap: shipping?.giftWrap ?? false,
          },
          payment: {
            method: values.method,
            senderNumber: values.senderNumber,
            screenshotUrl: values.screenshotUrl,
          },
          couponCode: coupon?.code,
        }),
      });

      const payload = (await response.json()) as {
        data?: { orderNumber: string; id: string };
        error?: string;
      };

      if (response.ok && payload.data) {
        orderNumber = payload.data.orderNumber;
        persistedId = payload.data.id;
      } else {
        toast.warning("Order saved locally", {
          description: payload.error ?? "The order service is unreachable — demo mode.",
        });
      }
    } catch {
      toast.warning("Order saved locally", {
        description: "No backend reachable — your order lives in this browser session.",
      });
    }

    placeOrder(items, totals, {
      id: persistedId,
      orderNumber,
      payment: {
        method: values.method,
        status: method === "COD" ? "UNPAID" : "PENDING",
        reference: orderNumber,
        senderNumber: values.senderNumber,
        screenshotUrl: values.screenshotUrl,
      },
    });

    clearCart();
    setPlacing(false);

    toast.success("Order placed successfully! 🎉", {
      description:
        method === "COD"
          ? "Pay in cash when your parcel arrives."
          : "We'll confirm your order as soon as the payment is verified.",
    });
  };

  const senderHint = config.numbers?.[0] ?? "";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Payment Method</h2>
        <PaymentSecurityNote />
      </header>

      <PaymentMethodPicker
        value={method}
        onChange={(next) => {
          setValue("method", next, { shouldValidate: true });
          setValue("confirmed", next === "COD", { shouldValidate: false });
        }}
      />
      <input type="hidden" {...register("method")} />

      {/* ---------- Cash on delivery ---------- */}
      {method === "COD" && (
        <div className="glass-soft flex flex-col gap-3 rounded-2xl border border-glass-border p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-emerald-400" aria-hidden />
            You&apos;ll pay {formatMoney(totals.total)} in cash when your order arrives
          </p>
          <p className="text-sm text-muted-foreground">
            Please keep exact change ready. Our delivery partner collects payment at your doorstep
            and hands over a printed receipt. 🚚
          </p>
        </div>
      )}

      {/* ---------- Manual mobile wallets ---------- */}
      {manual && (
        <div className="flex flex-col gap-4">
          <div className="glass-soft flex flex-col gap-3 rounded-2xl border border-glass-border p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="size-4 text-rose" aria-hidden />
              Send {formatMoney(totals.total)} to one of these {config.name} numbers
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {(config.numbers ?? []).map((number, index) => (
                <CopyableValue
                  key={number}
                  label={`${config.name} number ${index + 1}`}
                  value={number}
                  hint={index === 0 ? "Preferred — verified fastest" : undefined}
                />
              ))}
            </div>

            <div className="rounded-xl border border-glass-border bg-[#141414] px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Reference
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                Your <span className="font-mono">LL-…</span> order number, generated when you place
                the order
              </p>
              <p className="text-[11px] text-muted-foreground">
                Quote it in the {config.name} reference field so we can match your payment
              </p>
            </div>

            {config.ussd && (
              <p className="text-xs text-muted-foreground">
                Prefer USSD? Dial <span className="font-mono text-foreground">{config.ussd}</span>{" "}
                and follow the prompts.
              </p>
            )}

            <ol className="mt-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {(config.instructions ?? "").split("\n").map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Screenshot upload */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Payment screenshot
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  void handleScreenshot(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="h-12 w-full gap-2 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary sm:w-auto"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" />
                    Upload Payment Screenshot
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">Image only · max 2MB</span>
            </div>

            {(localPreview || screenshotUrl) && (
              <div className="relative w-fit overflow-hidden rounded-xl border border-glass-border">
                <Image
                  src={screenshotUrl || localPreview || ""}
                  alt="Payment screenshot preview"
                  width={220}
                  height={220}
                  unoptimized={Boolean(screenshotUrl) && !screenshotUrl.startsWith("/uploads")}
                  className="h-32 w-auto object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setValue("screenshotUrl", "", { shouldValidate: true });
                    setLocalPreview(null);
                  }}
                  aria-label="Remove screenshot"
                  className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full border border-glass-border bg-[#0A0A0A]/85 text-muted-foreground transition-colors duration-300 hover:text-rose focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}

            {errors.screenshotUrl && (
              <p role="alert" className="text-xs text-rose">
                {errors.screenshotUrl.message}
              </p>
            )}

            <Field
              label="Transaction ID (optional)"
              htmlFor="pay-transaction"
              error={errors.transactionId?.message}
              hint="Found in the wallet's confirmation SMS."
            >
              <Input
                id="pay-transaction"
                placeholder="e.g. 8N7A2K4LQ1"
                className={cn(checkoutInputClass, "font-mono")}
                {...register("transactionId")}
              />
            </Field>

            <Field
              label="Number you're sending from"
              htmlFor="pay-sender"
              error={errors.senderNumber?.message}
              hint={senderHint ? `Send from your own ${config.name} number` : undefined}
            >
              <Input
                id="pay-sender"
                type="tel"
                inputMode="tel"
                placeholder="+880 1700 000000"
                aria-invalid={Boolean(errors.senderNumber)}
                className={checkoutInputClass}
                {...register("senderNumber")}
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-glass-border bg-glass px-4 py-3.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-glass-border accent-[var(--primary)]"
                {...register("confirmed")}
              />
              <span>
                I&apos;ve completed the payment
                <span className="mt-1 block text-xs text-muted-foreground">
                  Your order will be confirmed after payment verification (usually within 1–2
                  hours).
                </span>
              </span>
            </label>
            {errors.confirmed && (
              <p role="alert" className="text-xs text-rose">
                {errors.confirmed.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- Disabled gateway ---------- */}
      {method === "SSLCOMMERZ" && (
        <div className="glass-soft flex items-start gap-3 rounded-2xl border border-glass-border p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-cyan" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Coming soon</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {config.comingSoon} Until then, cash on delivery and the mobile wallets are ready to
              go. 💳
            </p>
          </div>
        </div>
      )}

      {/* ---------- Nav ---------- */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          className="h-12 w-full gap-2 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary sm:w-auto"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <Button
          type="submit"
          disabled={!isValid || placing || uploading}
          className="group h-14 w-full gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_46px_-8px_rgba(212,175,55,0.95)] disabled:opacity-45 disabled:shadow-none sm:w-auto motion-safe:hover:not-disabled:scale-[1.02]"
        >
          {placing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              {method === "COD" ? "Place Order 🎉" : "Submit for Verification"}
            </>
          )}
        </Button>
      </div>

      {manual && !confirmed && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardCopy className="size-3.5" aria-hidden />
          Tip: send the exact amount and keep the reference handy — verification is manual.
        </p>
      )}
    </form>
  );
}
