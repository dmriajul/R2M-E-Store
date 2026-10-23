"use client";

import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Script from "next/script";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTurnstileSiteKey,
  TURNSTILE_RESPONSE_FIELD,
  type TurnstileAction,
} from "@/lib/turnstile-shared";

export const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
export const TURNSTILE_ONLOAD_CALLBACK = "onloadTurnstileCallback";
export const TURNSTILE_SCRIPT_SRC =
  `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${TURNSTILE_ONLOAD_CALLBACK}`;

interface TurnstileRenderOptions {
  sitekey: string;
  action: TurnstileAction;
  theme: "dark";
  appearance: "always";
  size: "flexible";
  retry: "auto";
  "retry-interval": number;
  "refresh-expired": "auto";
  "refresh-timeout": "auto";
  "response-field": boolean;
  "response-field-name": string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": (errorCode?: unknown) => void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
}

interface TurnstileBrowserApi {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string | undefined;
  reset?: (widgetId?: string) => void;
  remove?: (widgetId: string) => void;
  getResponse?: (widgetId?: string) => string | undefined;
}

type TurnstileWindow = Window &
  typeof globalThis & {
    turnstile?: TurnstileBrowserApi;
    onloadTurnstileCallback?: () => void;
  };

export interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  /** The widget is locked to the site's dark luxury theme. */
  theme?: "dark";
  action?: TurnstileAction;
  /** Optional explicit site key override (defaults to NEXT_PUBLIC_TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY). */
  siteKey?: string;
}

type CaptchaStatus = "loading" | "ready" | "verified" | "expired" | "unavailable" | "timeout";

const onloadSubscribers = new Set<() => void>();

/**
 * Register a listener on Cloudflare's `onload=onloadTurnstileCallback` hook.
 *
 * Unlike `@marsidev/react-turnstile@1.6.1`, this callback is never deleted from
 * `window` and does not rely on a one-shot module-scoped Promise, so SPA route
 * transitions, Strict Mode remounts, and manual script retries always receive
 * readiness notifications.
 */
function subscribeTurnstileOnload(listener: () => void): () => void {
  onloadSubscribers.add(listener);
  if (typeof window !== "undefined") {
    const win = window as TurnstileWindow;
    if (typeof win.onloadTurnstileCallback !== "function") {
      win.onloadTurnstileCallback = () => {
        for (const notify of onloadSubscribers) notify();
      };
    }
  }
  return () => {
    onloadSubscribers.delete(listener);
  };
}

/**
 * Guarantee `<script id="cf-turnstile-script" src="...api.js?render=explicit..." async defer>`
 * exists in the DOM. Next.js `<Script strategy="afterInteractive">` handles SSR
 * preloading and initial injection; this fallback ensures retries (after a
 * blocked script was removed from the DOM) and isolated non-Next test roots
 * always mount a live `<script async defer>` tag without duplicates.
 */
function ensureTurnstileScriptElement(): HTMLScriptElement | null {
  if (typeof document === "undefined") return null;
  const existing =
    (document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
  if (existing) {
    if (!existing.id) existing.id = TURNSTILE_SCRIPT_ID;
    existing.async = true;
    existing.defer = true;
    return existing;
  }

  const script = document.createElement("script");
  script.id = TURNSTILE_SCRIPT_ID;
  script.src = TURNSTILE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  (document.head ?? document.body ?? document.documentElement).appendChild(script);
  return script;
}

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
 * a gold-framed “Security check” card with the widget centred in a 300px well
 * that scales fluidly on small screens.
 *
 * Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`
 * with `async` and `defer`, renders explicitly into a `data-sitekey` container,
 * emits the canonical `cf-turnstile-response` hidden form field, and cleans up
 * widgets on unmount/reset.
 */
function TurnstileWidget({
  onVerify,
  onError,
  action = "review",
  siteKey: siteKeyProp,
}: TurnstileCaptchaProps) {
  const siteKey = getTurnstileSiteKey(siteKeyProp);
  const uid = useId().replace(/:/g, "");
  const alive = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ onVerify, onError });
  const [status, setStatus] = useState<CaptchaStatus>("loading");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [hasNativeResponseInput, setHasNativeResponseInput] = useState(false);

  useEffect(() => {
    callbacks.current = { onVerify, onError };
  }, [onVerify, onError]);

  const unavailable = useCallback((errorCode?: unknown) => {
    if (!alive.current) return;
    if (errorCode === "110200") {
      console.warn(
        "[turnstile] Domain is not authorized for this Turnstile widget (110200). Add this hostname in Cloudflare Turnstile widget settings.",
      );
    } else if (errorCode === "csp-blocked") {
      console.warn(
        "[turnstile] Content-Security-Policy blocked challenges.cloudflare.com. Allow script-src and frame-src https://challenges.cloudflare.com.",
      );
    } else {
      console.warn(
        "[turnstile] Security check failed to load. Check the CDN request, CSP and Cloudflare domain allowlist.",
      );
    }
    setVerifiedToken("");
    callbacks.current.onVerify("");
    callbacks.current.onError?.();
    setStatus("unavailable");
  }, []);

  const tryRenderWidget = useCallback(() => {
    if (!alive.current || !siteKey) return;
    if (widgetIdRef.current !== null) return;
    const container = containerRef.current;
    const api = typeof window === "undefined" ? undefined : (window as TurnstileWindow).turnstile;
    if (!container || typeof api?.render !== "function") return;

    try {
      const renderedId = api.render(container, {
        sitekey: siteKey,
        action,
        theme: "dark",
        appearance: "always",
        size: "flexible",
        retry: "auto",
        "retry-interval": 8_000,
        "refresh-expired": "auto",
        "refresh-timeout": "auto",
        "response-field": true,
        "response-field-name": TURNSTILE_RESPONSE_FIELD,
        callback: (token: string) => {
          if (!alive.current) return;
          const clean = typeof token === "string" ? token.trim() : "";
          setVerifiedToken(clean);
          setStatus(clean ? "verified" : "ready");
          callbacks.current.onVerify(clean);
        },
        "expired-callback": () => {
          if (!alive.current) return;
          setVerifiedToken("");
          callbacks.current.onVerify("");
          setStatus("expired");
        },
        "error-callback": (errorCode?: unknown) => {
          unavailable(errorCode);
        },
        "timeout-callback": () => {
          unavailable("widget-timeout");
        },
        "unsupported-callback": () => {
          unavailable("unsupported-browser");
        },
      });

      if (typeof renderedId === "string" && renderedId.length > 0) {
        widgetIdRef.current = renderedId;
        setHasNativeResponseInput(
          Boolean(container.querySelector(`input[name="${TURNSTILE_RESPONSE_FIELD}"]`)),
        );
        setStatus((prev) => (prev === "verified" ? prev : "ready"));
      } else {
        unavailable("empty-widget-id");
      }
    } catch {
      unavailable("render-error");
    }
  }, [action, siteKey, unavailable]);

  const retry = useCallback(() => {
    if (!alive.current) return;
    setVerifiedToken("");
    setHasNativeResponseInput(false);
    callbacks.current.onVerify("");
    callbacks.current.onError?.();

    const api = typeof window === "undefined" ? undefined : (window as TurnstileWindow).turnstile;
    if (api && widgetIdRef.current && typeof api.reset === "function") {
      try {
        api.reset(widgetIdRef.current);
      } catch {
        // Widget removal and remount happen via `attempt` change below.
      }
    } else if (!api) {
      document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
    }
    setAttempt((value) => value + 1);
    setStatus("loading");
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!siteKey) {
      console.error(
        "[turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY. Configure the public site key and rebuild the application.",
      );
      unavailable("missing-site-key");
      return () => {
        alive.current = false;
      };
    }

    const unsubscribeOnload = subscribeTurnstileOnload(tryRenderWidget);
    const script = ensureTurnstileScriptElement();
    const handleLoad = () => tryRenderWidget();
    const handleError = () => unavailable("script-error");
    script?.addEventListener("load", handleLoad);
    script?.addEventListener("error", handleError);

    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (
        target instanceof window.HTMLScriptElement &&
        target.src.startsWith("https://challenges.cloudflare.com/turnstile/")
      ) {
        unavailable("script-error");
      }
    };
    const handleCspViolation = (event: Event) => {
      const blockedUri = (event as SecurityPolicyViolationEvent).blockedURI ?? "";
      if (blockedUri.includes("challenges.cloudflare.com")) {
        unavailable("csp-blocked");
      }
    };
    document.addEventListener("error", handleResourceError, true);
    document.addEventListener("securitypolicyviolation", handleCspViolation);

    tryRenderWidget();

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (
      widgetIdRef.current === null &&
      typeof (window as TurnstileWindow).turnstile?.render !== "function"
    ) {
      pollInterval = setInterval(() => {
        if (typeof (window as TurnstileWindow).turnstile?.render === "function") {
          if (pollInterval !== null) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          tryRenderWidget();
        }
      }, 100);
    }

    return () => {
      alive.current = false;
      unsubscribeOnload();
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
      document.removeEventListener("error", handleResourceError, true);
      document.removeEventListener("securitypolicyviolation", handleCspViolation);
      if (pollInterval !== null) clearInterval(pollInterval);

      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId) {
        try {
          (window as TurnstileWindow).turnstile?.remove?.(widgetId);
        } catch {
          // Ignore cleanup errors from detached iframes.
        }
      }
    };
  }, [siteKey, attempt, tryRenderWidget, unavailable]);

  useEffect(() => {
    if (!siteKey || status !== "loading") return;
    const timer = setTimeout(() => {
      unavailable("script-timeout");
      setStatus("timeout");
    }, 15_000);
    return () => clearTimeout(timer);
  }, [siteKey, status, attempt, unavailable]);

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
      {siteKey && (
        <Script
          id={TURNSTILE_SCRIPT_ID}
          src={TURNSTILE_SCRIPT_SRC}
          strategy="afterInteractive"
          async
          defer
          onLoad={tryRenderWidget}
          onReady={tryRenderWidget}
          onError={() => unavailable("script-error")}
        />
      )}

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
              <div
                ref={containerRef}
                id={`mukra-turnstile-${uid}`}
                key={attempt}
                data-sitekey={siteKey}
                data-action={action}
                data-theme="dark"
                data-size="flexible"
                className="flex w-full justify-center border-0 bg-transparent shadow-none [&_iframe]:max-w-full [&_iframe]:border-0 [&_iframe]:shadow-none"
                style={{ minWidth: 0, width: "100%", maxWidth: "100%", minHeight: 65 }}
              />
              {!hasNativeResponseInput && (
                <input
                  type="hidden"
                  name={TURNSTILE_RESPONSE_FIELD}
                  value={verifiedToken}
                  readOnly
                />
              )}
              {failed && (
                <div
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#141210] px-2 text-center"
                >
                  <p className="text-xs text-muted-foreground">
                    Security check failed to load. Please retry.
                  </p>
                  <button
                    type="button"
                    onClick={retry}
                    className="text-xs text-primary underline"
                  >
                    Retry
                  </button>
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

      <noscript>
        Enable JavaScript to complete the security check. Submission remains disabled.
      </noscript>
    </div>
  );
}

/** Keep a provider render failure from taking down the authentication form. */
class CaptchaBoundary extends Component<
  TurnstileCaptchaProps & { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    console.warn("[turnstile] Widget rendering failed.");
    this.props.onVerify("");
    this.props.onError?.();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="rounded-2xl border border-primary/25 bg-[#141210] p-4 text-center text-xs text-muted-foreground"
      >
        <p>Security check failed to load. Please retry.</p>
        <button
          type="button"
          className="mt-2 text-primary underline"
          onClick={() => this.setState({ failed: false })}
        >
          Retry
        </button>
        <p className="mt-2">
          If this persists, disable ad-blockers or try another browser.
        </p>
      </div>
    );
  }
}

export function TurnstileCaptcha(props: TurnstileCaptchaProps) {
  return (
    <CaptchaBoundary {...props}>
      <TurnstileWidget {...props} />
    </CaptchaBoundary>
  );
}
