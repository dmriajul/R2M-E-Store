import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/sections/Reveal";

/** Stagger between banner text elements: ~100ms, per the animation rules. */
const TEXT_STAGGER_S = 0.1;

/** Shorter travel than <Reveal>'s default 40px — these are text lines. */
const TEXT_DISTANCE_PX = 16;

/**
 * Editorial campaign banner — full-bleed, sits between the New Arrivals grid
 * and the featured carousel.
 *
 * Server Component: there is no state here, only an image, a gradient scrim and
 * a link, so it renders entirely on the server and costs no client JS.
 *
 * Spacing: the section itself is edge-to-edge by design (that is what makes it
 * read as a campaign), so the global rhythm token lives on the *inner* content
 * container — `py-24 lg:py-32`, the same value every other section uses on its
 * wrapper. No extra margins are stacked on top.
 *
 * Performance: the banner is always below the fold, so the photo is lazy-loaded
 * and carries no `priority`.
 */
export function CampaignBanner() {
  return (
    <section
      aria-labelledby="winter-edit-title"
      className="relative w-full overflow-hidden"
    >
      <div className="relative isolate min-h-[26rem] w-full sm:min-h-[32rem] lg:min-h-[38rem]">
        {/* Decorative campaign photography. The headline below carries the
            message, so the image is marked decorative (empty alt) rather than
            announcing redundant text to screen readers. */}
        <Image
          src="/images/campaigns/winter-edit.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />

        {/* Scrim: strongest on the left where the copy sits, clearing to
            transparent on the right so the photography stays visible. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/70 to-[#050816]/10"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#050816]/80 to-transparent"
        />

        {/* Content frame — carries the shared `py-24 lg:py-32` rhythm token. */}
        <div className="relative mx-auto flex min-h-[26rem] w-full max-w-7xl flex-col justify-center px-4 py-24 sm:min-h-[32rem] sm:px-6 lg:min-h-[38rem] lg:px-8 lg:py-32">
          {/* Copy staggers in 100ms steps through the shared <Reveal /> wrapper.
              Only opacity and transform move, and the shorter `distance` keeps
              the lines from sliding too far. */}
          <div className="max-w-xl">
            <Reveal delay={0} distance={TEXT_DISTANCE_PX}>
              <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
                Campaign
              </p>
            </Reveal>

            <Reveal delay={TEXT_STAGGER_S} distance={TEXT_DISTANCE_PX}>
              <h2
                id="winter-edit-title"
                className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
              >
                The Winter Edit
              </h2>
              <span
                aria-hidden
                className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
              />
            </Reveal>

            <Reveal delay={TEXT_STAGGER_S * 2} distance={TEXT_DISTANCE_PX}>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
                Layered knits, brushed cottons and quietly luxurious outerwear —
                cut for playgrounds, built for the cold.
              </p>
            </Reveal>

            <Reveal delay={TEXT_STAGGER_S * 3} distance={TEXT_DISTANCE_PX}>
              <Link
                href="/shop?sort=newest"
                className="group mt-8 inline-flex items-center gap-3 border-b border-primary/45 pb-2 text-[11px] font-semibold tracking-[0.2em] text-white uppercase transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
              >
                Shop Collection
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-300 ease-[var(--ease-luxe)] group-hover:translate-x-1 motion-reduce:transition-none"
                />
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
