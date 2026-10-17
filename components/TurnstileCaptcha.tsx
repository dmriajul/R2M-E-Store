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
  }, [siteKey, unavailable]);

  const options = useMemo(() => ({
    theme, action, appearance: "always" as const,
    // Flexible uses the available width and a low-profile challenge footprint.
    size: "flexible" as const,
    responseField: false, refreshExpired: "auto" as const, refreshTimeout: "auto" as const,
  }), [theme, action]);
  const scriptOptions = useMemo(() => ({ onError: unavailable }), [unavailable]);
  const failed = !siteKey || status === "unavailable";

  return (
    <div className="min-w-0 rounded-2xl border border-primary/25 bg-[#141210] p-3">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Security check</p>
      <div className="flex min-h-[74px] w-full items-center justify-center [&_iframe]:border-0" data-turnstile-action={action}>
        {siteKey ? (
          <Turnstile id={`mukra-turnstile-${id.replace(/:/g, "")}`} siteKey={siteKey}
            options={options} scriptOptions={scriptOptions} rerenderOnCallbackChange={false}
            onWidgetLoad={ready} onSuccess={success} onError={unavailable}
            onExpire={expire} onTimeout={unavailable} onUnsupported={unavailable} />
        ) : (
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Security check unavailable. Please refresh.
          </p>
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
