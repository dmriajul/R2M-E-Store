import Image from "next/image";
import { cn } from "@/lib/utils";

export type MukraLogoVariant = "wordmark" | "monogram" | "lockup";
export type MukraLogoSize = "sm" | "md" | "lg";

interface MukraLogoProps {
  variant?: MukraLogoVariant;
  size?: MukraLogoSize;
  priority?: boolean;
  tone?: "light" | "dark";
  className?: string;
}

const MARK_SIZE: Record<MukraLogoSize, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

const WORDMARK_SIZE: Record<MukraLogoSize, { width: number; height: number }> = {
  sm: { width: 112, height: 30 },
  md: { width: 152, height: 40 },
  lg: { width: 176, height: 46 },
};

function Monogram({ size, priority }: { size: MukraLogoSize; priority: boolean }) {
  const dimension = MARK_SIZE[size];
  return (
    <Image
      src="/icons/favico.png"
      alt="MUKRA"
      width={dimension}
      height={dimension}
      priority={priority}
      className="shrink-0 object-contain"
    />
  );
}

function Wordmark({
  size,
  priority,
  tone,
}: {
  size: MukraLogoSize;
  priority: boolean;
  tone: "light" | "dark";
}) {
  const dimensions = WORDMARK_SIZE[size];
  return (
    <Image
      src={tone === "light" ? "/logo.png" : "/logo-dark.png"}
      alt="MUKRA"
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      className="h-auto w-auto max-w-full object-contain"
    />
  );
}

export function MukraLogo({
  variant = "lockup",
  size = "md",
  priority = false,
  tone = "light",
  className,
}: MukraLogoProps) {
  if (variant === "monogram") {
    return <Monogram size={size} priority={priority} />;
  }

  if (variant === "wordmark") {
    return <Wordmark size={size} priority={priority} tone={tone} />;
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Monogram size={size} priority={priority} />
      <Wordmark size={size} priority={priority} tone={tone} />
    </span>
  );
}
