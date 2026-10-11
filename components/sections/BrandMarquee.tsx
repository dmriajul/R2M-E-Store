import { MARQUEE_WORDS } from "@/lib/site";

/**
 * Infinite outline-text marquee. The animation is pure CSS (see the
 * `marquee` keyframes in globals.css): the track holds two identical halves and
 * translates by -50%, so the loop is seamless with no JS and no layout thrash.
 *
 * Note: `-webkit-text-stroke` cannot take a gradient, so the stroke is solid
 * gold and a vertical mask fades it — which reads as a metallic gradient —
 * plus a gold gradient sheen sweeps across on top.
 */
export function BrandMarquee() {
  const row = [...MARQUEE_WORDS, ...MARQUEE_WORDS];

  return (
    <section
      aria-label="Brand values"
      className="relative overflow-hidden border-y border-glass-border bg-[#111] py-8 md:py-10"
    >
      {/* Edge fades keep the loop seam invisible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,#111_0%,transparent_12%,transparent_88%,#111_100%)]"
      />

      {/* The rolling text is decorative; the values are exposed once to AT. */}
      <p className="sr-only">
        Our values: {MARQUEE_WORDS.join(", ")}.
      </p>

      <div
        aria-hidden
        className="flex w-max animate-marquee items-center will-change-transform"
      >
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center">
            {row.map((word, index) => (
              <span key={`${half}-${word}-${index}`} className="flex items-center">
                <span className="px-6 text-xl font-light tracking-[0.2em] text-transparent [-webkit-text-stroke:1px_rgba(212,175,55,0.6)] md:px-10 md:text-2xl">
                  {word}
                </span>
                <span
                  aria-hidden
                  className="text-2xl font-light text-primary/60 md:text-3xl"
                >
                  ·
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
