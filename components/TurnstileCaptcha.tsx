"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TurnstileAction } from "@/lib/turnstile-shared";

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  /** The widget is locked to the site's dark luxury theme. */
  theme?: "dark";
  action?: TurnstileAction;
}

type CaptchaStatus = "loading" | "ready" | "verified" | "expired" | "unavailable";

/** Status line copy, announced via aria-live. Kept short and neutral in every state. */
function statusMessage(status: CaptchaStatus, failed: boolean): string {
  if (failed) return "Please refresh the page to try again.";
  switch (status) {
    case "loading":
      // The widget well carries the visible loading state; avoid duplicate copy.
      return "";
    case "expired":
      return "Security check expired. Please complete it again.";
    case "verified":
      return "Security check complete.";
    default:
      return "Please complete the security check to continue.";
  }
}

/**
 * Cloudflare Turnstile presented as a native piece of the dark luxury theme:
 * a gold-framed “Security check” card with the widget centred in a fixed
 * 300px well that scales fluidly on small screens.
 *
 * The installed wrapper owns script deduplication and widget removal on unmount.
 * Submit buttons stay disabled in every state except a live, verified token —
 * see `useTurnstile` and the auth forms.
 */
export function TurnstileCaptcha({ onVerify, onError, action = "review" }: TurnstileCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const uid = useId().replace(/:/g, "");
  const alive = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onVerify, onError });
  const [status, setStatus] = useState<CaptchaStatus>("loading");

  useEffect(() => {
    callbacks.current = { onVerify, onError };
  }, [onVerify, onError]);

  const unavailable = useCallback(() => {
    if (!alive.current) return;
    clearTimeout(watchdog.current);
    callbacks.current.onVerify("");
    callbacks.current.onError?.();
    setStatus("unavailable");
  }, []);
  const ready = useCallback(() => {
    if (!alive.current) return;
    clearTimeout(watchdog.current);
    callbacks.current.onVerify("");
    setStatus("ready");
  }, []);
  const success = useCallback((token: string) => {
    if (!alive.current) return;
    clearTimeout(watchdog.current);
    setStatus("verified");
    callbacks.current.onVerify(token);
  }, []);
  const expire = useCallback(() => {
    if (!alive.current) return;
    callbacks.current.onVerify("");
    setStatus("expired");
  }, []);

  useEffect(() => {
    alive.current = true;
    // A deduplicated script can outlive its original widget. Listen per mount,
    // rather than relying solely on the first wrapper's script.onerror handler.
    const scriptError = (event: Event) => {
      const target = event.target;
      if (
        target instanceof window.HTMLScriptElement &&
        target.src.startsWith("https://challenges.cloudflare.com/turnstile/")
      ) {
        unavailable();
      }
    };
    document.addEventListener("error", scriptError, true);
    if (!siteKey) unavailable();
    else watchdog.current = setTimeout(unavailable, 5_000);
    return () => {
      alive.current = false;
      document.removeEventListener("error", scriptError, true);
      clearTimeout(watchdog.current);
    };
  }, [siteKey, unavailable]);

  const options = useMemo(
    () => ({
      theme: "dark" as const,
      action,
      appearance: "always" as const,
      // Flexible uses the available width and a low-profile ~65px challenge footprint.
      size: "flexible" as const,
      responseField: false,
      refreshExpired: "auto" as const,
      refreshTimeout: "auto" as const,
    }),
    [action],
  );
  const scriptOptions = useMemo(() => ({ onError: unavailable }), [unavailable]);

  const failed = !siteKey || status === "unavailable";
  const loading = Boolean(siteKey) && status === "loading" && !failed;
  const message = statusMessage(status, failed);

  return (
    <div
      role="group"
      aria-label="Security check (CAPTCHA)"
      aria-describedby={`mukra-turnstile-status-${uid}`}
      className="min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-[#141210] p-3 sm:p-4"
    >
      <div className="mb-2.5 flex items-center justify-center gap-2">
        <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-primary/50" />
        <p
          id={`mukra-turnstile-label-${uid}`}
          className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
        >
          Security check
        </p>
      </div>

      <div className="mx-auto w-full max-w-[300px]">
        <div
          data-turnstile-action={action}
          aria-busy={loading}
          className={cn(
            "relative flex min-h-[68px] w-full items-center justify-center overflow-hidden rounded-[10px]",
            failed && "border border-dashed border-white/[0.06] bg-white/[0.02]",
          )}
        >
          {siteKey && !failed ? (
            <>
              <Turnstile
                id={`mukra-turnstile-${uid}`}
                siteKey={siteKey}
                options={options}
                scriptOptions={scriptOptions}
                rerenderOnCallbackChange={false}
                onWidgetLoad={ready}
                onSuccess={success}
                onError={unavailable}
                onExpire={expire}
                onTimeout={unavailable}
                onUnsupported={unavailable}
                className="flex w-full justify-center border-0 bg-transparent shadow-none [&_iframe]:max-w-full [&_iframe]:border-0 [&_iframe]:shadow-none"
                style={{ minWidth: 0, maxWidth: "100%" }}
              />
              {loading && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-[10px] bg-[#141210]"
                >
                  <Loader2 className="size-4 animate-spin text-muted-foreground/70 motion-reduce:animate-none" />
                  <span className="text-xs tracking-wide text-muted-foreground">
                    Loading security check...
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-4 py-2 text-center">
              <ShieldOff aria-hidden className="size-4 text-muted-foreground/60" />
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                Verification unavailable
              </p>
            </div>
          )}
        </div>

        <p
          id={`mukra-turnstile-status-${uid}`}
          role="status"
          aria-live="polite"
          className={cn(
            "mt-2.5 min-h-5 text-center text-xs leading-5",
            status === "verified" && !failed
              ? "text-emerald-300/90"
              : status === "expired" && !failed
                ? "text-amber-200/80"
                : "text-muted-foreground",
          )}
        >
          {message}
        </p>
      </div>

      <noscript>Enable JavaScript to complete the security check. Submission remains disabled.</noscript>
    </div>
  );
}
