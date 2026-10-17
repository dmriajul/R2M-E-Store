import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Development-only replacement for the Turnstile widget.
 *
 * Rendered exclusively when `isTurnstileBypassed()` is true, which requires
 * NODE_ENV=development (`next dev`). It states the trade-off plainly so a local
 * session can never be mistaken for a production build's security posture.
 */
export function CaptchaBypassNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border border-dashed border-amber-300/30 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/80",
        className,
      )}
    >
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-200/70" />
      <span>
        <strong className="font-semibold text-amber-100">
          Security check bypassed in development.
        </strong>{" "}
        CAPTCHA is enforced in production builds.
      </span>
    </div>
  );
}
