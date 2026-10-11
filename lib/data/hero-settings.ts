import { DEFAULT_HERO_SETTINGS, type HeroSettings } from "@/lib/hero-settings";
import { getPrisma } from "@/lib/prisma";

const SETTINGS_ID = "global";

export async function getHeroSettings(): Promise<HeroSettings> {
  const db = await getPrisma();
  if (!db) return DEFAULT_HERO_SETTINGS;

  try {
    const row = await db.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!row || typeof row !== "object") return DEFAULT_HERO_SETTINGS;

    const settings = row as Partial<HeroSettings>;
    return {
      heroTitle: settings.heroTitle ?? null,
      heroSubtitle: settings.heroSubtitle ?? null,
      heroBadgeText: settings.heroBadgeText ?? null,
      heroMediaUrl: settings.heroMediaUrl ?? null,
      heroMediaType: settings.heroMediaType === "image" ? "image" : "video",
      primaryCtaText: settings.primaryCtaText ?? null,
      primaryCtaLink: settings.primaryCtaLink ?? null,
      secondaryCtaText: settings.secondaryCtaText ?? null,
      secondaryCtaLink: settings.secondaryCtaLink ?? null,
    };
  } catch (error) {
    console.error("[site-settings] Failed to load hero settings", error);
    return DEFAULT_HERO_SETTINGS;
  }
}

export async function saveHeroSettings(settings: HeroSettings): Promise<HeroSettings> {
  const db = await getPrisma();
  if (!db) throw new Error("Hero settings require a configured database");

  const values = {
    heroTitle: settings.heroTitle || null,
    heroSubtitle: settings.heroSubtitle || null,
    heroBadgeText: settings.heroBadgeText || null,
    heroMediaUrl: settings.heroMediaUrl || null,
    heroMediaType: settings.heroMediaType,
    primaryCtaText: settings.primaryCtaText || null,
    primaryCtaLink: settings.primaryCtaLink || null,
    secondaryCtaText: settings.secondaryCtaText || null,
    secondaryCtaLink: settings.secondaryCtaLink || null,
  };

  await db.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...values },
    update: values,
  });

  return { ...DEFAULT_HERO_SETTINGS, ...values };
}
