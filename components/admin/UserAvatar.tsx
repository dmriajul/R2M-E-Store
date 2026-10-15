"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn, initials } from "@/lib/utils";

export type UserAvatarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Readonly<Record<UserAvatarSize, string>> = {
  sm: "size-8 text-[11px]",
  md: "size-9 text-[11px]",
  lg: "size-14 text-base",
};

/** Gold for staff, blue for shoppers — the console's existing palette. */
const TONE_CLASS = {
  staff: "border-primary/35 bg-gold-soft text-primary",
  customer: "border-blue-500/30 bg-blue-500/12 text-blue-300",
} as const;

interface UserAvatarProps {
  /** Display name — the initials fallback and the `alt` text come from here. */
  name: string;
  /** Uploaded picture. Missing, blank or broken URLs fall back to initials. */
  src?: string | null;
  size?: UserAvatarSize;
  /** Shopper accounts read blue; everyone else gets the gold console tone. */
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}

/**
 * The console's avatar: the uploaded picture when there is one, initials when
 * there isn't.
 *
 * Three details matter in the admin UI:
 *
 * 1. **A broken URL must never look broken.** An upload can be deleted from
 *    Cloudinary (or the local `.uploads` folder can be wiped between deploys), so
 *    `onError` swaps straight back to the initials chip instead of leaving a
 *    torn-image icon in the rail.
 * 2. **Stable across renders.** The error flag is keyed to the URL, so switching
 *    accounts retries the new picture rather than inheriting the old failure.
 * 3. **Decorative by default.** Avatars here always sit next to the person's
 *    name, so they are `aria-hidden` and the name does the talking.
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  tone = "staff",
  className,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = src?.trim() ? src.trim() : null;

  /* A new picture deserves a fresh attempt. */
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImage = Boolean(url) && !failed;

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border font-semibold",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- session avatars come from Cloudinary or /uploads, so next/image would need a config entry per host
        <img
          src={url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/**
 * The signed-in operator's avatar, read straight from the Auth.js session.
 *
 * `useSession()` is cheap here — `AuthProvider` (the root `SessionProvider`)
 * already fetched the session for the navbar, and the admin layout hands the
 * *role* down through `AdminSessionProvider` during the server render, so there
 * is no permission flash: this only supplies the picture the role payload
 * doesn't carry. When the session has no image (or the request fails) the
 * initials chip renders, which is the console's long-standing look.
 */
export function OperatorAvatar({
  name,
  size = "md",
  className,
}: {
  /** Fallback name and the initials source — always available server-side. */
  name: string;
  size?: UserAvatarSize;
  className?: string;
}) {
  const { data } = useSession();
  const image = data?.user?.image ?? null;

  return <UserAvatar name={data?.user?.name ?? name} src={image} size={size} className={className} />;
}
