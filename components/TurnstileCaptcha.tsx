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

/** Up to 2 silent automatic script retries (3 total attempts) before surfacing manual Retry UI. */
export const TURNSTILE_MAX_AUTO_RETRIES = 2;
/** Per-attempt script load window before silently replacing a stalled script request. */
export const TURNSTILE_ATTEMPT_TIMEOUT_MS = 10_000;
/** Total load threshold across initial attempt + silent auto-retries (30s). */
export const TURNSTILE_LOAD_TIMEOUT_MS =
  TURNSTILE_ATTEMPT_TIMEOUT_MS * (TURNSTILE_MAX_AUTO_RETRIES + 1);
/** Base backoff delay (ms) before silently retrying after a transient `<script>` network error. */
export const TURNSTILE_ERROR_RETRY_DELAY_MS = 1_200;
const TURNSTILE_POLL_INTERVAL_MS = 100;
/** Transient Cloudflare Turnstile client/challenge codes (`300xxx`, `600xxx`) eligible for silent retry. */
const RETRIABLE_WIDGET_ERROR_CODE = /^(?:300|600)\d{3}$/;

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
  "error-callback": (errorCode?: unknown) => boolean | void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
}

interface TurnstileBrowserApi {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string | undefined;
  reset?: (widgetId?: string) => void;
  remove?: (widgetId: string) => void;
  getResponse?: (widgetId?: string) => string | undefined;
}

type TurnstileOnloadDispatcher = (() => void) & {
  __mukraTurnstileDispatcher?: true;
};

type TurnstileWindow = Window &
  typeof globalThis & {
    turnstile?: TurnstileBrowserApi;
    onloadTurnstileCallback?: TurnstileOnloadDispatcher;
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
 * Install a persistent `window.onloadTurnstileCallback` dispatcher eagerly so
 * SSR-preloaded `<Script strategy="afterInteractive">` executions never miss
 * the callback during hydration or child-before-parent effect flushing.
 */
function ensureTurnstileOnloadCallback(): void {
  if (typeof window === "undefined") return;
  const win = window as TurnstileWindow;
  const current = win.onloadTurnstileCallback;
  if (current?.__mukraTurnstileDispatcher) return;

  const dispatcher: TurnstileOnloadDispatcher = () => {
    if (typeof current === "function") {
      try {
        current();
      } catch {
        // Isolate any pre-existing callback errors.
      }
    }
    for (const notify of [...onloadSubscribers]) {
      try {
        notify();
      } catch {
        // Isolate subscriber errors so one mount never blocks another.
      }
    }
  };
  dispatcher.__mukraTurnstileDispatcher = true;
  win.onloadTurnstileCallback = dispatcher;
}

if (typeof window !== "undefined") {
  ensureTurnstileOnloadCallback();
}

/**
 * Register a listener on Cloudflare's `onload=onloadTurnstileCallback` hook.
 *
 * Unlike `@marsidev/react-turnstile@1.6.1`, this callback is never deleted from
 * `window` and does not rely on a one-shot module-scoped Promise, so SPA route
 * transitions, Strict Mode remounts, and manual/automatic script retries always
 * receive readiness notifications — and immediately invoke the listener when
 * `window.turnstile` is already present in `window`.
 */
function subscribeTurnstileOnload(listener: () => void): () => void {
  onloadSubscribers.add(listener);
  ensureTurnstileOnloadCallback();
  if (
    typeof window !== "undefined" &&
    typeof (window as TurnstileWindow).turnstile?.render === "function"
  ) {
    listener();
  }
  return () => {
    onloadSubscribers.delete(listener);
  };
}

function findTurnstileScriptElements(): HTMLScriptElement[] {
  if (typeof document === "undefined") return [];
  const seen = new Set<HTMLScriptElement>();
  const byId = document.getElementById(TURNSTILE_SCRIPT_ID);
  if (byId && byId.tagName === "SCRIPT") {
    seen.add(byId as HTMLScriptElement);
  }
  const bySrc = document.querySelectorAll<HTMLScriptElement>(
    'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
  );
  for (const el of bySrc) {
    seen.add(el);
  }
  return [...seen];
}

function removeTurnstileScriptElements(): void {
  for (const script of findTurnstileScriptElements()) {
    script.remove();
  }
}

function attachScriptStatusTracking(script: HTMLScriptElement): void {
  if (script.dataset.turnstileTracked === "true") return;
  script.dataset.turnstileTracked = "true";
  if (!script.dataset.turnstileStatus) {
    script.dataset.turnstileStatus =
      typeof window !== "undefined" &&
      typeof (window as TurnstileWindow).turnstile?.render === "function"
        ? "loaded"
        : "loading";
  }
  script.addEventListener(
    "load",
    () => {
      script.dataset.turnstileStatus = "loaded";
    },
    { once: true },
  );
  script.addEventListener(
    "error",
    () => {
      script.dataset.turnstileStatus = "error";
    },
    { once: true },
  );
}

/**
 * Guarantee a live `<script id="cf-turnstile-script" src="...api.js?render=explicit..." async defer>`
 * exists in the DOM. Next.js `<Script strategy="afterInteractive">` handles SSR
 * preloading and initial injection; this fallback deduplicates stray tags,
 * replaces dead/errored script tags across SPA transitions or silent retries,
 * and mounts a clean `<script async defer>` tag in isolated roots.
 */
function ensureTurnstileScriptElement(): HTMLScriptElement | null {
  if (typeof document === "undefined") return null;
  ensureTurnstileOnloadCallback();

  const apiReady =
    typeof window !== "undefined" &&
    typeof (window as TurnstileWindow).turnstile?.render === "function";

  let primary: HTMLScriptElement | null = null;
  for (const candidate of findTurnstileScriptElements()) {
    if (!apiReady && candidate.dataset.turnstileStatus === "error") {
      candidate.remove();
      continue;
    }
    if (!primary) {
      primary = candidate;
    } else {
      candidate.remove();
    }
  }

  if (primary) {
    if (!primary.id) primary.id = TURNSTILE_SCRIPT_ID;
    primary.async = true;
    primary.defer = true;
    if (apiReady) primary.dataset.turnstileStatus = "loaded";
    attachScriptStatusTracking(primary);
    return primary;
  }

  const script = document.createElement("script");
  script.id = TURNSTILE_SCRIPT_ID;
  script.src = TURNSTILE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  attachScriptStatusTracking(script);
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
 * Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback`
 * with `strategy="afterInteractive"`, renders explicitly into a `data-sitekey`
 * container as soon as `window.turnstile` is interactive, silently auto-retries
 * transient network/extension delays, emits the canonical `cf-turnstile-response`
 * hidden form field, and cleans up widgets on unmount/reset.
 */
function TurnstileWidget({
  onVerify,
  onError,
  action = "review",
  siteKey: siteKeyProp,
}: TurnstileCaptchaProps) {
  const siteKey = getTurnstileSiteKey(siteKeyProp);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const unmountedRef = useRef(false);
  const failedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const autoRetryCountRef = useRef(0);
  const widgetErrorRetriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [manualAttempt, setManualAttempt] = useState(0);
  const callbacks = useRef({ onVerify, onError });
  const [status, setStatus] = useState<CaptchaStatus>("loading");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [hasNativeResponseInput, setHasNativeResponseInput] = useState(false);

  useEffect(() => {
    callbacks.current = { onVerify, onError };
  }, [onVerify, onError]);

  const unavailable = useCallback((errorCode?: unknown) => {
    if (unmountedRef.current) return;
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (!failedRef.current) {
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
    }
    failedRef.current = true;
    setVerifiedToken("");
    callbacks.current.onVerify("");
    callbacks.current.onError?.();
    setStatus("unavailable");
  }, []);

  const tryRenderWidget = useCallback(() => {
    if (unmountedRef.current || !siteKey) return;
    if (widgetIdRef.current !== null) return;
    const container = containerRef.current;
    const api = typeof window === "undefined" ? undefined : (window as TurnstileWindow).turnstile;
    if (!container || typeof api?.render !== "function") return;

    if (container.childNodes.length > 0) {
      container.replaceChildren();
    }

    try {
      const renderedId = api.render(container, {
        sitekey: siteKey,
        action,
        theme: "dark",
        appearance: "always",
        size: "flexible",
        retry: "auto",
        "retry-interval": 3_000,
        "refresh-expired": "auto",
        "refresh-timeout": "auto",
        "response-field": true,
        "response-field-name": TURNSTILE_RESPONSE_FIELD,
        callback: (token: string) => {
          if (unmountedRef.current) return;
          const clean = typeof token === "string" ? token.trim() : "";
          failedRef.current = false;
          autoRetryCountRef.current = 0;
          widgetErrorRetriesRef.current = 0;
          setVerifiedToken(clean);
          setStatus(clean ? "verified" : "ready");
          callbacks.current.onVerify(clean);
        },
        "expired-callback": () => {
          if (unmountedRef.current) return;
          setVerifiedToken("");
          callbacks.current.onVerify("");
          setStatus("expired");
        },
        "error-callback": (errorCode?: unknown) => {
          if (unmountedRef.current) return;
          if (
            typeof errorCode === "string" &&
            RETRIABLE_WIDGET_ERROR_CODE.test(errorCode) &&
            widgetErrorRetriesRef.current < TURNSTILE_MAX_AUTO_RETRIES
          ) {
            widgetErrorRetriesRef.current += 1;
            setVerifiedToken("");
            callbacks.current.onVerify("");
            return false;
          }
          unavailable(errorCode);
        },
        "timeout-callback": () => {
          if (unmountedRef.current) return;
          setVerifiedToken("");
          callbacks.current.onVerify("");
          setStatus("expired");
        },
        "unsupported-callback": () => {
          unavailable("unsupported-browser");
        },
      });

      if (typeof renderedId === "string" && renderedId.length > 0) {
        if (retryTimerRef.current !== null) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        failedRef.current = false;
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

  const scheduleSilentScriptRetry = useCallback(
    (reason: "script-error" | "script-timeout") => {
      if (unmountedRef.current || widgetIdRef.current !== null || failedRef.current) return;

      // Never trigger a false-positive script failure/timeout if `window.turnstile` is already interactive.
      if (
        typeof window !== "undefined" &&
        typeof (window as TurnstileWindow).turnstile?.render === "function"
      ) {
        tryRenderWidget();
        return;
      }

      if (retryTimerRef.current !== null) return;

      if (autoRetryCountRef.current < TURNSTILE_MAX_AUTO_RETRIES) {
        const nextRetry = autoRetryCountRef.current + 1;
        autoRetryCountRef.current = nextRetry;

        if (reason === "script-timeout") {
          removeTurnstileScriptElements();
          setStatus("loading");
          setAttempt((value) => value + 1);
          return;
        }

        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (unmountedRef.current || widgetIdRef.current !== null || failedRef.current) return;
          if (typeof (window as TurnstileWindow).turnstile?.render === "function") {
            tryRenderWidget();
            return;
          }
          removeTurnstileScriptElements();
          setStatus("loading");
          setAttempt((value) => value + 1);
        }, TURNSTILE_ERROR_RETRY_DELAY_MS * nextRetry);
        return;
      }

      unavailable(reason);
      if (reason === "script-timeout") {
        setStatus("timeout");
      }
    },
    [tryRenderWidget, unavailable],
  );

  const retry = useCallback(() => {
    if (unmountedRef.current) return;
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    failedRef.current = false;
    autoRetryCountRef.current = 0;
    widgetErrorRetriesRef.current = 0;
    setVerifiedToken("");
    setHasNativeResponseInput(false);
    callbacks.current.onVerify("");
    callbacks.current.onError?.();

    const api = typeof window === "undefined" ? undefined : (window as TurnstileWindow).turnstile;
    if (api && widgetIdRef.current && typeof api.remove === "function") {
      try {
        api.remove(widgetIdRef.current);
      } catch {
        // Widget removal and remount happen via `attempt` change below.
      }
      widgetIdRef.current = null;
    } else if (api && widgetIdRef.current && typeof api.reset === "function") {
      try {
        api.reset(widgetIdRef.current);
      } catch {
        // Widget removal and remount happen via `attempt` change below.
      }
      widgetIdRef.current = null;
    } else if (typeof api?.render !== "function") {
      removeTurnstileScriptElements();
    }

    setStatus("loading");
    setManualAttempt((value) => value + 1);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (!siteKey) {
      console.error(
        "[turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY. Configure the public site key and rebuild the application.",
      );
      unavailable("missing-site-key");
      return () => {
        unmountedRef.current = true;
      };
    }

    const script = ensureTurnstileScriptElement();
    const unsubscribeOnload = subscribeTurnstileOnload(tryRenderWidget);
    const handleLoad = () => {
      if (script) script.dataset.turnstileStatus = "loaded";
      tryRenderWidget();
    };
    const handleError = () => {
      if (script) script.dataset.turnstileStatus = "error";
      scheduleSilentScriptRetry("script-error");
    };
    script?.addEventListener("load", handleLoad);
    script?.addEventListener("error", handleError);

    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (
        target instanceof window.HTMLScriptElement &&
        (target.id === TURNSTILE_SCRIPT_ID ||
          target.src.startsWith("https://challenges.cloudflare.com/turnstile/"))
      ) {
        target.dataset.turnstileStatus = "error";
        scheduleSilentScriptRetry("script-error");
      }
    };
    const handleCspViolation = (event: Event) => {
      const blockedUri = (event as SecurityPolicyViolationEvent).blockedURI ?? "";
      if (blockedUri.includes("challenges.cloudflare.com")) {
        unavailable("csp-blocked");
      }
    };
    const handleOnline = () => {
      if (unmountedRef.current || widgetIdRef.current !== null) return;
      if (typeof (window as TurnstileWindow).turnstile?.render === "function") {
        failedRef.current = false;
        tryRenderWidget();
        return;
      }
      if (failedRef.current) {
        retry();
      } else {
        removeTurnstileScriptElements();
        setAttempt((value) => value + 1);
      }
    };

    document.addEventListener("error", handleResourceError, true);
    document.addEventListener("securitypolicyviolation", handleCspViolation);
    window.addEventListener("online", handleOnline);

    tryRenderWidget();

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (widgetIdRef.current === null && !failedRef.current) {
      pollInterval = setInterval(() => {
        if (widgetIdRef.current !== null || unmountedRef.current || failedRef.current) {
          if (pollInterval !== null) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }
        if (typeof (window as TurnstileWindow).turnstile?.render === "function") {
          tryRenderWidget();
          if ((widgetIdRef.current !== null || failedRef.current) && pollInterval !== null) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }, TURNSTILE_POLL_INTERVAL_MS);
    }

    return () => {
      unmountedRef.current = true;
      unsubscribeOnload();
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
      document.removeEventListener("error", handleResourceError, true);
      document.removeEventListener("securitypolicyviolation", handleCspViolation);
      window.removeEventListener("online", handleOnline);
      if (pollInterval !== null) clearInterval(pollInterval);
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

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
  }, [siteKey, attempt, tryRenderWidget, scheduleSilentScriptRetry, unavailable, retry]);

  useEffect(() => {
    if (!siteKey || status !== "loading") return;

    const retryTimers: Array<ReturnType<typeof setTimeout>> = [];
    for (let step = 1; step <= TURNSTILE_MAX_AUTO_RETRIES; step++) {
      retryTimers.push(
        setTimeout(() => {
          scheduleSilentScriptRetry("script-timeout");
        }, TURNSTILE_ATTEMPT_TIMEOUT_MS * step),
      );
    }

    const deadlineTimer = setTimeout(() => {
      if (unmountedRef.current || widgetIdRef.current !== null || failedRef.current) return;
      if (
        typeof window !== "undefined" &&
        typeof (window as TurnstileWindow).turnstile?.render === "function"
      ) {
        tryRenderWidget();
        return;
      }
      unavailable("script-timeout");
      setStatus("timeout");
    }, TURNSTILE_LOAD_TIMEOUT_MS);

    return () => {
      for (const timer of retryTimers) clearTimeout(timer);
      clearTimeout(deadlineTimer);
    };
  }, [siteKey, status, manualAttempt, scheduleSilentScriptRetry, tryRenderWidget, unavailable]);

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
          onError={() => scheduleSilentScriptRetry("script-error")}
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
  TurnstileCaptchaProps & { children: (retryKey: number) => ReactNode },
  { failed: boolean; retryKey: number }
> {
  state = { failed: false, retryKey: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    console.warn("[turnstile] Widget rendering failed.");
    this.props.onVerify("");
    this.props.onError?.();
  }
  render() {
    if (!this.state.failed) return this.props.children(this.state.retryKey);
    return (
      <div
        role="alert"
        className="rounded-2xl border border-primary/25 bg-[#141210] p-4 text-center text-xs text-muted-foreground"
      >
        <p>Security check failed to load. Please retry.</p>
        <button
          type="button"
          className="mt-2 text-primary underline"
          onClick={() =>
            this.setState((prev) => ({ failed: false, retryKey: prev.retryKey + 1 }))
          }
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
      {(retryKey) => <TurnstileWidget key={retryKey} {...props} />}
    </CaptchaBoundary>
  );
}
