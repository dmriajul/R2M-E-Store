"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, scorePassword } from "@/lib/validations";

interface PasswordStrengthProps {
  value: string;
  className?: string;
}

const LEVELS = [
  { label: "Too weak", color: "bg-rose", text: "text-rose" },
  { label: "Weak", color: "bg-rose", text: "text-rose" },
  { label: "Fair", color: "bg-amber-400", text: "text-amber-400" },
  { label: "Good", color: "bg-lavender", text: "text-lavender" },
  { label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" },
] as const;

/**
 * Four-segment strength meter (red → amber → lavender → green) plus the rule
 * checklist, driven by the same `PASSWORD_RULES` the Zod schema enforces.
 */
export function PasswordStrength({ value, className }: PasswordStrengthProps) {
  const score = scorePassword(value);
  const level = LEVELS[score] ?? LEVELS[0];
  const filled = value.length === 0 ? 0 : score;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5" role="presentation">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-500",
                index < filled ? level.color : "bg-white/10",
              )}
            />
          ))}
        </div>
        <span
          aria-live="polite"
          className={cn("w-16 text-right text-[11px] font-medium", value ? level.text : "text-muted-foreground")}
        >
          {value ? level.label : ""}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const passed = value.length > 0 && rule.test(value);

          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 text-[11px] transition-colors duration-300",
                passed ? "text-emerald-400" : "text-muted-foreground",
              )}
            >
              <Check
                aria-hidden
                className={cn("size-3", passed ? "opacity-100" : "opacity-35")}
              />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
