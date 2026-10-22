"use client";

import { Component, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
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

type CaptchaStatus = "loading" | "ready" | "verified" | "expired" | "unavailable" | "timeout";

/** Status line copy, announced via aria-live. Kept short and neutral in every state. */
function statusMessage(status: CaptchaStatus, failed: boolean): string {
  if (failed) return "If this persists, disable ad-blockers or try another browser.";
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
function TurnstileWidget({ onVerify, onError, action = "review" }: TurnstileCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const uid = useId().replace(/:/g, "");
  const alive = useRef(false);
  const widgetRef = useRef<TurnstileInstance>(null);
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ onVerify, onError });
  const [status, setStatus] = useState<CaptchaStatus>("loading");

  useEffect(() => {
    callbacks.current = { onVerify, onError };
  }, [onVerify, onError]);

  const unavailable = useCallback(() => {
    if (!alive.current) return;
    console.warn("[turnstile] Security check failed to load. Check the CDN request, CSP and Cloudflare domain allowlist.");
    callbacks.current.onVerify("");
    callbacks.current.onError?.();
    setStatus("unavailable");
  }, []);
  const ready = useCallback(() => {
    if (!alive.current) return;
    callbacks.current.onVerify("");
    setStatus("ready");
  }, []);
  const success = useCallback((token: string) => {
    if (!alive.current) return;
    setStatus("verified");
    callbacks.current.onVerify(token);
  }, []);
  const retry = useCallback(() => {
    if (!alive.current) return;
    callbacks.current.onVerify("");
    callbacks.current.onError?.();
    // Reset existing challenges; a blocked script needs a fresh loader attempt.
    if (window.turnstile) widgetRef.current?.reset();
    else document.getElementById("cf-turnstile-script")?.remove();
    setAttempt((value) => value + 1);
    setStatus("loading");
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
    if (!siteKey) {
      console.error("[turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY. Configure the public site key and rebuild the application.");
      unavailable();
    }
    return () => {
      alive.current = false;
      document.removeEventListener("error", scriptError, true);
    };
  }, [siteKey, unavailable]);

  useEffect(() => {
    if (!siteKey || status !== "loading") return;
    const timer = setTimeout(() => {
      unavailable();
      setStatus("timeout");
    }, 15_000);
    return () => clearTimeout(timer);
  }, [siteKey, status, attempt, unavailable]);

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
  // Do NOT pass scriptOptions.onError: wrapper 1.6.1 deletes its global
  // onload callback when that option is present, preventing API initialization.
  // The capture-phase resource error listener above handles blocked scripts.

  const failed = !siteKey || status === "unavailable" || status === "timeout";
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
          {siteKey ? (
            <>
              <Turnstile
                id={`mukra-turnstile-${uid}`}
                siteKey={siteKey}
                options={options}
                ref={widgetRef}
                key={attempt}
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
              {failed && (
                <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#141210] px-2 text-center">
                  <p className="text-xs text-muted-foreground">Security check failed to load. Please retry.</p>
                  <button type="button" onClick={retry} className="text-xs text-primary underline">Retry</button>
                </div>
              )}
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
                Verification unavailable: security check configuration is missing.
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


/** Keep a provider render failure from taking down the authentication form. */
class CaptchaBoundary extends Component<TurnstileCaptchaProps & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    console.warn("[turnstile] Widget rendering failed.");
    this.props.onVerify("");
    this.props.onError?.();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border border-primary/25 bg-[#141210] p-4 text-center text-xs text-muted-foreground">
        <p>Security check failed to load. Please retry.</p>
        <button type="button" className="mt-2 text-primary underline" onClick={() => this.setState({ failed: false })}>Retry</button>
        <p className="mt-2">If this persists, disable ad-blockers or try another browser.</p>
      </div>
    );
  }
}

export function TurnstileCaptcha(props: TurnstileCaptchaProps) {
  return <CaptchaBoundary {...props}><TurnstileWidget {...props} /></CaptchaBoundary>;
}
