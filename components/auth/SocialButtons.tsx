"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signIn, type SignInResponse } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { clearIdentityCaches } from "@/lib/session-cache";
import { queueAuthSuccess } from "@/lib/auth-flash";
import { safeCallbackPath } from "@/lib/auth-redirect";
import { loginErrorCode } from "@/lib/auth-messages";

/**
 * Brand marks as inline SVG (lucide-react v1 dropped brand icons).
 */

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      viewBox="0 0 17 20"
      aria-hidden
      className="size-4 fill-current"
      focusable="false"
    >
      <path d="M14.16 10.63c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.53ZM12 4.47c.61-.74 1.02-1.76.9-2.79-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.97-.49 2.58-1.22Z" />
    </svg>
  );
}

/**
 * Where to land after a successful social sign-in (middleware adds ?callbackUrl=).
 * Same origin-guarded source the Credentials form uses.
 */
function currentCallbackUrl(): string {
  return safeCallbackPath(
    new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    ).get("callbackUrl"),
    typeof window === "undefined" ? "" : window.location.origin,
  );
}

/**
 * Social sign-in buttons.
 *
 * Google runs the real Auth.js OAuth flow (redirect-less, then a hard navigate
 * to the callback URL on success). Apple remains an unwired placeholder.
 */
export function SocialButtons() {
  const [googlePending, setGooglePending] = useState(false);

  const onGoogleSignIn = async () => {
    if (googlePending) return;
    setGooglePending(true);
    try {
      const result: SignInResponse = await signIn("google", {
        redirect: false,
        callbackUrl: currentCallbackUrl(),
      });

      if (!result || result.error || !result.ok) {
        toast.warning(loginErrorCode(result?.code), {
          description: "Google sign-in did not complete. Please try again, or sign in with your email and password.",
        });
        return;
      }

      /* Drop whatever the previous identity left cached *before* the next page
         loads — so an admin never opens the console on a shopper's data, and a
         shopper never inherits an operator's session data. */
      clearIdentityCaches();

      queueAuthSuccess("SIGNED_IN");

      window.location.assign(result.url || "/");
    } catch {
      toast.warning("SERVER_ERROR", {
        description: "Google sign-in did not complete. Please try again, or sign in with your email and password.",
      });
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onGoogleSignIn}
        disabled={googlePending}
        className="h-12 gap-2.5 rounded-full border-glass-border bg-glass text-sm font-medium transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/40 hover:bg-white/8 hover:text-foreground"
      >
        {GoogleMark()}
        Google
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          toast.warning("Apple sign-in is currently unavailable", {
            description: "Please sign in with your email and password.",
            duration: Infinity,
            closeButton: true,
          })
        }
        className="h-12 gap-2.5 rounded-full border-glass-border bg-glass text-sm font-medium transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/40 hover:bg-white/8 hover:text-foreground"
      >
        {AppleMark()}
        Apple
      </Button>
    </div>
  );
}
