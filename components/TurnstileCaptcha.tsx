"use client";

import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  theme?: "dark" | "light";
}

export function TurnstileCaptcha({
  onVerify,
  onError,
  theme = "dark",
}: TurnstileCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) return null;

  return (
    <div className="rounded-2xl border border-[#1f2b4d]/80 bg-[#050816]/90 p-2 shadow-[0_0_0_1px_rgba(148,163,184,0.12)] backdrop-blur-md">
      <Turnstile
        siteKey={siteKey}
        options={{ theme, appearance: "always", size: "normal" }}
        onSuccess={onVerify}
        onError={onError}
        onExpire={onError}
      />
    </div>
  );
}
