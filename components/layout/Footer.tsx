import Image from "next/image";
import Link from "next/link";
import { FOOTER_LINKS, SITE } from "@/lib/site";
import { Separator } from "@/components/ui/separator";
import {
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/layout/SocialIcons";

/**
 * Footer columns come straight from FOOTER_LINKS in site.ts — the single
 * source of truth, already deduped: each destination appears exactly once,
 * under one canonical name (e.g. "Shipping Info" in Support only;
 * "Returns & Refunds", "Privacy Policy" and "Terms & Conditions" in Legal).
 */

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com", icon: InstagramIcon },
  { label: "X", href: "https://x.com", icon: XIcon },
  { label: "YouTube", href: "https://youtube.com", icon: YouTubeIcon },
  { label: "LinkedIn", href: "https://linkedin.com", icon: LinkedInIcon },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-glass-border bg-[#070707]">
      <span aria-hidden className="hairline-gold block h-px w-full" />

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4 lg:gap-8">
          {/* ---------- Brand column ---------- */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="MUKRA home"
              className="inline-flex transition-opacity duration-300 hover:opacity-80"
            >
              <Image
                src="/logo.png"
                alt="MUKRA"
                width={180}
                height={50}
                priority
                className="h-10 w-auto object-contain md:h-12"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {SITE.tagline} Curated in small numbers for people who prefer to
              own less, better.
            </p>

            <ul className="mt-6 flex items-center gap-2">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-glass-border bg-glass text-muted-foreground transition-all duration-300 ease-[var(--ease-luxe)] hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Icon className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- Link columns ---------- */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => {
            return (
              <div key={heading}>
                <h3 className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
                  {heading}
                </h3>
                <ul className="mt-5 flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <Separator className="my-12 bg-glass-border" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {year} {SITE.name}. All rights reserved.
          </p>
          <p className="tracking-[0.2em] uppercase">
            Designed for the few · Built with Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
