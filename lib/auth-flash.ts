"use client";

import { toast } from "sonner";
import { AUTH_SUCCESS_MESSAGES } from "@/lib/auth-messages";

const KEY = "mukra-auth-success";
export const AUTH_SUCCESS_DURATION = 5000;
type AuthSuccessCode = keyof typeof AUTH_SUCCESS_MESSAGES;

/** One allowlisted code only, never credentials/PII; survives the intentional hard navigation. */
export function queueAuthSuccess(code: AuthSuccessCode): void {
  try {
    window.sessionStorage.setItem(KEY, code);
  } catch {
    // Storage may be blocked; do not delay sign-in/navigation to keep a toast visible.
    toast.success(AUTH_SUCCESS_MESSAGES[code], { duration: AUTH_SUCCESS_DURATION });
  }
}

export function consumeAuthSuccess(): string | null {
  try {
    const code = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return code && Object.hasOwn(AUTH_SUCCESS_MESSAGES, code) ? AUTH_SUCCESS_MESSAGES[code as AuthSuccessCode] : null;
  } catch {
    return null;
  }
}
