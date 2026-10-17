"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileAction } from "@/lib/turnstile-shared";

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  theme?: "dark" | "light";
  action?: TurnstileAction;
}

/** The installed wrapper owns script deduplication and widget removal on unmount. */
export function TurnstileCaptcha({ onVerify, onError, theme = "dark", action = "review" }: TurnstileCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const id = useId();
  const alive = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onVerify, onError });
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "expired" | "unavailable">("loading");

  useEffect(() => { callbacks.current = { onVerify, onError }; }, [onVerify, onError]);
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
    if (process.env.NODE_ENV === "development") {
      // The site key is public. Never log the server secret or challenge token.
      // eslint-disable-next-line no-console
      console.log("[Turnstile] Site Key:", siteKey || "MISSING", "Action:", action);
    }
    // A deduplicated script can outlive its original widget. Listen per mount,
    // rather than relying solely on the first wrapper's script.onerror handler.
    const scriptError = (event: Event) => {
      const target = event.target;
      if (target instanceof window.HTMLScriptElement &&
          target.src.startsWith("https://challenges.cloudflare.com/turnstile/")) unavailable();
    };
    document.addEventListener("error", scriptError, true);
    if (!siteKey) unavailable();
    else watchdog.current = setTimeout(unavailable, 5_000);
    return () => {
      alive.current = false;
      document.removeEventListener("error", scriptError, true);
      clearTimeout(watchdog.current);
    };
  }, [siteKey, unavailable, action]);

  const options = useMemo(() => ({
    theme, action, appearance: "always" as const,
    // Compact stays visible even in narrow mobile forms; no resize-driven widget resets.
    size: "compact" as const,
    responseField: false, refreshExpired: "auto" as const, refreshTimeout: "auto" as const,
  }), [theme, action]);
  const scriptOptions = useMemo(() => ({ onError: unavailable }), [unavailable]);
  const failed = !siteKey || status === "unavailable";

  return (
    <div className="min-w-0 rounded-2xl border border-primary/25 bg-[#141210] p-3">
      {process.env.NODE_ENV === "development" && (
        <div style={{
          background: "red",
          color: "white",
          padding: "10px",
          margin: "10px 0",
          borderRadius: "5px",
          fontWeight: "bold",
        }}>
          TURNSTILE DEBUG: Site Key = {siteKey ? "PRESENT" : "MISSING"}
        </div>
      )}
      <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Security check</p>
      <div className="flex min-h-[140px] w-full items-center justify-center" data-turnstile-action={action}>
        {siteKey ? (
          <Turnstile id={`mukra-turnstile-${id.replace(/:/g, "")}`} siteKey={siteKey}
            options={options} scriptOptions={scriptOptions} rerenderOnCallbackChange={false}
            onWidgetLoad={ready} onSuccess={success} onError={unavailable}
            onExpire={expire} onTimeout={unavailable} onUnsupported={unavailable} />
        ) : (
          <div className="text-center text-xs leading-5">
            <p className="text-muted-foreground">Security check unavailable. Please refresh.</p>
            {process.env.NODE_ENV === "development" && (
              <p className="mt-2 break-words text-amber-200">
                Development setup: set NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env.local and restart the development server. Submission stays disabled until the security check is available and completed.
              </p>
            )}
          </div>
        )}
      </div>
      <noscript>Enable JavaScript to complete the security check. Submission remains disabled.</noscript>
      <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-muted-foreground">
        {failed ? "Security check unavailable. Please refresh." : status === "expired"
          ? "Security check expired. Please complete it again."
          : status === "verified" ? "Security check complete." : "Complete the security check to continue."}
      </p>
    </div>
  );
}
