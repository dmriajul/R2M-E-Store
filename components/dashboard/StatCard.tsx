"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  /** The "Track" / "View" / "Redeem" affordance. */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  index?: number;
  className?: string;
}

/** One glass tile in the overview stats row. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  action,
  index = 0,
  className,
}: StatCardProps) {
  const reducedMotion = usePrefersReducedMotion();

  const actionClass =
    "inline-flex items-center rounded-full px-1 py-0.5 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase transition-colors duration-300 hover:text-gold-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <motion.div
      initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0.2 : 0.45,
        delay: reducedMotion ? 0 : index * 0.06,
        ease: EASE_LUXE,
      }}
      whileHover={reducedMotion ? undefined : { y: -4 }}
      className={cn(
        "glass-soft shadow-playful flex flex-col gap-3 rounded-2xl p-4 transition-colors duration-500 ease-[var(--ease-luxe)] hover:border-primary/30",
        className,
      )}
    >
      <span aria-hidden className="text-2xl">
        {icon}
      </span>

      <div className="flex flex-col gap-1">
        <span className="text-2xl leading-none font-bold text-primary">{value}</span>
        <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </span>
      </div>

      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}

      {action &&
        (action.href ? (
          <Link href={action.href} className={cn(actionClass, "self-start")}>
            {action.label} →
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={cn(actionClass, "self-start")}>
            {action.label} →
          </button>
        ))}
    </motion.div>
  );
}
