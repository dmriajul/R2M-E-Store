export type HeroMediaType = "video" | "image";

export interface HeroSettings {
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroBadgeText: string | null;
  heroMediaUrl: string | null;
  heroMediaType: HeroMediaType;
  primaryCtaText: string | null;
  primaryCtaLink: string | null;
  secondaryCtaText: string | null;
  secondaryCtaLink: string | null;
}

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  heroTitle: null,
  heroSubtitle: null,
  heroBadgeText: null,
  heroMediaUrl: null,
  heroMediaType: "video",
  primaryCtaText: null,
  primaryCtaLink: null,
  secondaryCtaText: null,
  secondaryCtaLink: null,
};
