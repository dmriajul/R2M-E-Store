import Link from "next/link";
import { SITE } from "@/lib/site";

/**
 * Focused auth shell: no navbar, no footer. The backdrop is pure CSS — two
 * slowly drifting gradient orbs plus a faint gold grid — so it costs nothing
 * and animates on the compositor. Motion is opt-out friendly: the drift is
 * driven by `--animate-float`-style keyframes that globals.css disables under
 * `prefers-reduced-motion`.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* ---------- Animated background ---------- */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_-10%,#141210_0%,#0a0a0a_55%,#080808_100%)]" />
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/12 blur-[120px] motion-safe:animate-[float_14s_ease-in-out_infinite]" />
        <div className="absolute -right-24 bottom-0 size-[26rem] rounded-full bg-lavender/12 blur-[120px] motion-safe:animate-[float_18s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/3 left-1/2 size-[20rem] -translate-x-1/2 rounded-full bg-rose/8 blur-[120px] motion-safe:animate-[float_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]" />
      </div>

      {/* ---------- Content ---------- */}
      <main
        id="main-content"
        className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6"
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="text-gradient-gold text-2xl font-bold tracking-widest transition-opacity duration-300 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              LITTLE {SITE.name}
            </Link>
            <p className="mt-2 text-xs tracking-[0.28em] text-muted-foreground uppercase">
              Adorable styles for little ones
            </p>
          </div>

          {children}
        </div>
      </main>

      <footer className="relative z-10 pb-8 text-center text-[11px] text-muted-foreground">
        <p>
          Need a hand?{" "}
          <Link
            href="/#contact"
            className="text-primary underline-offset-4 transition-colors duration-300 hover:underline"
          >
            Contact our concierge
          </Link>
        </p>
      </footer>
    </div>
  );
}
