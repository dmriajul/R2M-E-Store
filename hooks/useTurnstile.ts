"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Remount after every submission: Cloudflare tokens are single-use, even on bad passwords. */
export function useTurnstile() {
  const [token, setToken] = useState("");
  const tokenRef = useRef("");
  const [generation, setGeneration] = useState(0);

  const onVerify = useCallback((value: string) => {
    const normalized = value.trim();
    tokenRef.current = normalized;
    setToken(normalized);
  }, []);
  const clearToken = useCallback(() => {
    tokenRef.current = "";
    setToken("");
  }, []);
  /** Atomically hand one token to a request; a rapid second submit gets nothing. */
  const consumeToken = useCallback(() => {
    const current = tokenRef.current;
    tokenRef.current = "";
    setToken("");
    return current;
  }, []);
  const reset = useCallback(() => {
    clearToken();
    setGeneration((value) => value + 1);
  }, [clearToken]);

  useEffect(() => {
    if (!token) return;
    // Cloudflare's server enforces its own expiry; clear slightly earlier in the UI.
    const timer = setTimeout(reset, 250_000);
    return () => clearTimeout(timer);
  }, [token, reset]);

  return {
    token,
    generation,
    onVerify,
    onError: clearToken,
    clearToken,
    consumeToken,
    reset,
  };
}
