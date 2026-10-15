import { scheduleImageCleanup } from "@/lib/data/media";
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

  const previous = await readHeroMediaUrl(db);
  await db.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...values },
    update: values,
  });

  // A replaced banner image (mukra/banners) is deleted once nothing uses it.
  scheduleImageCleanup([previous], [values.heroMediaUrl]);
  return { ...DEFAULT_HERO_SETTINGS, ...values };
}

/** The banner currently saved (for cleanup). Never throws. */
async function readHeroMediaUrl(
  db: NonNullable<Awaited<ReturnType<typeof getPrisma>>>,
): Promise<string | null> {
  try {
    const row = (await db.siteSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { heroMediaUrl: true },
    })) as { heroMediaUrl: string | null } | null;
    return row?.heroMediaUrl ?? null;
  } catch (error) {
    console.error("[site-settings] Could not read the current hero media", error);
    return null;
  }
}
