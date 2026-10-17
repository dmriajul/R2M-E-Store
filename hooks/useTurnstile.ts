"use client";

import { useCallback, useEffect, useState } from "react";

/** Remount after every submission: Cloudflare tokens are single-use, even on bad passwords. */
export function useTurnstile() {
  const [token, setToken] = useState("");
  const [generation, setGeneration] = useState(0);
  const onVerify = useCallback((value: string) => setToken(value.trim()), []);
  const onError = useCallback(() => setToken(""), []);
  const reset = useCallback(() => {
    setToken("");
    setGeneration((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!token) return;
    // Cloudflare's server enforces its own expiry; clear slightly earlier in the UI.
    const timer = setTimeout(reset, 250_000);
    return () => clearTimeout(timer);
  }, [token, reset]);
  return { token, generation, onVerify, onError, clearToken: onError, reset };
}
