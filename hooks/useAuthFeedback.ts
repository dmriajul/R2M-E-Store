"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage, isAuthWarning, type AuthErrorCode } from "@/lib/auth-messages";

export function useAuthFeedback() {
  const [code, setCode] = useState<AuthErrorCode | null>(null);
  const toastId = useRef<string | number | undefined>(undefined);
  const clear = useCallback(() => {
    if (toastId.current !== undefined) toast.dismiss(toastId.current);
    toastId.current = undefined;
    setCode(null);
  }, []);
  const show = useCallback((next: AuthErrorCode) => {
    if (toastId.current !== undefined) toast.dismiss(toastId.current);
    setCode(next);
    const options = { duration: Infinity, closeButton: true };
    toastId.current = isAuthWarning(next) ? toast.warning(authErrorMessage(next), options) : toast.error(authErrorMessage(next), options);
  }, []);
  useEffect(() => () => { if (toastId.current !== undefined) toast.dismiss(toastId.current); }, []);
  return { code, message: code ? authErrorMessage(code) : null, warning: code ? isAuthWarning(code) : false, clear, show };
}
