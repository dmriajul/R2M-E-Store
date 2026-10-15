import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MukraLogo } from "@/components/brand/MukraLogo";

/**
 * The console's brand lockup.
 *
 * **Why this exists.** The console rail used to hand `MukraLogo` the
 * `lockup`/`wordmark` variants, whose `next/image` carries `h-auto w-auto`. With
 * both dimensions on `auto` the browser falls back to the artwork's *intrinsic*
 * size (the wordmark is a 406×190 PNG), so the logo rendered ~2–3× the height of
 * the row it sat in: a fat band of gold script that pushed the rail header apart
 * and read as a broken image.
 *
 * The storefront solved the same trap long ago — `Navbar`/`Footer` render the
 * wordmark with **one definite dimension** (`h-10 w-auto object-contain`) — so
 * this component follows that house pattern: a bounded box, height set
 * explicitly, width left to the artwork's own ratio. The monogram (a square
 * favicon, which `MukraLogo` already sizes correctly) stays as it is, so the
 * collapsed rail keeps its mark.
 */

export type ConsoleBrandSize = "sm" | "md";

/**
 * Definite heights — the whole point of the fix.
 *
 * The artwork is 406×190 with ~16px of transparent padding on every side, so a
 * `h-8` box paints ~27px of actual script: level with the account rows below it
 * (which use `text-sm`), and a third of the height the unbounded version was
 * claiming.
 */
const WORDMARK_HEIGHT: Readonly<Record<ConsoleBrandSize, string>> = {
  sm: "h-8",
  md: "h-10",
};

const MARK_SIZE: Readonly<Record<ConsoleBrandSize, string>> = {
  sm: "size-8",
  md: "size-10",
};

/** The gold script wordmark, bounded by a definite height. */
export function ConsoleWordmark({
  size = "sm",
  className,
}: {
  size?: ConsoleBrandSize;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center", className)}>
      <Image
        src="/logo.png"
        alt="MUKRA"
        width={406}
        height={190}
        priority
        /*
         * `h-7 w-auto object-contain` — never `h-auto`: a definite height gives
         * the width something to resolve against, so the artwork scales instead
         * of spilling out of the rail.
         */
        className={cn(
          "w-auto max-w-full translate-y-px object-contain object-left",
          WORDMARK_HEIGHT[size],
        )}
      />
    </span>
  );
}

/** The square mark on its own — the collapsed rail's logo. */
export function ConsoleMark({
  size = "sm",
  className,
}: {
  size?: ConsoleBrandSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-md",
        MARK_SIZE[size],
        className,
      )}
    >
      <MukraLogo variant="monogram" size={size === "md" ? "md" : "sm"} priority />
    </span>
  );
}

interface ConsoleBrandProps {
  /** Collapsed rail: the mark only. */
  collapsed?: boolean;
  size?: ConsoleBrandSize;
  /** Renders the brand as plain (non-link) content — used by the drawer header. */
  asLink?: boolean;
  className?: string;
}

/**
 * Wordmark + `Admin` pill, or just the mark when the rail is collapsed.
 *
 * Keeps the rail header exactly one row tall at every breakpoint: the wordmark
 * is height-bounded, the pill is inline and the whole thing is a single link so
 * the click target stays generous on touch.
 */
export function ConsoleBrand({
  collapsed = false,
  size = "sm",
  asLink = true,
  className,
}: ConsoleBrandProps) {
  const content = (
    <>
      {collapsed ? (
        <ConsoleMark size={size} />
      ) : (
        <>
          <ConsoleMark size={size} />
          <span className={cn("flex min-w-0 items-center", "gap-2")}>
            <ConsoleWordmark size={size} />
            <span className="mt-0.5 inline-flex shrink-0 rounded border border-[#2A2A2A] bg-white/5 px-1.5 py-px text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Admin
            </span>
          </span>
        </>
      )}
    </>
  );

  const classes = cn(
    "flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-200",
    className,
  );

  if (!asLink) {
    return (
      <span className={classes} aria-label="Mukra admin">
        {content}
      </span>
    );
  }

  return (
    <Link
      href="/admin"
      aria-label="Mukra admin dashboard"
      className={cn(
        classes,
        "hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
      )}
    >
      {content}
    </Link>
  );
}
