"use client";

import { Camera, Cake, Gift, Mail, Phone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn, formatMonthYear, formatPrice, initials } from "@/lib/utils";
import { useDashboardStore } from "@/store/useDashboardStore";

/** Identity block above the profile forms — avatar, contact details, member since. */
export function ProfileCard() {
  const profile = useDashboardStore((state) => state.profile);

  const chips = [
    { icon: Mail, label: profile.email },
    { icon: Phone, label: profile.phone },
    { icon: Wallet, label: `Member since ${formatMonthYear(profile.memberSince)}` },
    { icon: Gift, label: `${profile.rewardPoints} reward points` },
    { icon: Cake, label: `Total spent ${formatPrice(profile.totalSpent)}` },
  ];

  return (
    <section className="glass-soft shadow-playful flex flex-col gap-6 rounded-3xl border border-glass-border p-6 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() =>
          toast.info("Photo uploads land with the backend 📸", {
            description: "For now your initials do the work.",
          })
        }
        aria-label="Change profile photo"
        className="group relative mx-auto shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:mx-0"
      >
        <span className="flex size-24 items-center justify-center rounded-full bg-linear-to-br from-primary via-rose to-lavender text-3xl font-bold text-black/80 shadow-[0_10px_40px_-14px_rgba(212,175,55,0.9)]">
          {initials(profile.name)}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/60 text-[10px] font-semibold tracking-[0.14em] text-white uppercase opacity-0 backdrop-blur-sm transition-opacity duration-400 ease-[var(--ease-luxe)] group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Camera className="size-4" />
          Change Photo
        </span>
      </button>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.kids.length > 0
            ? `Parent to ${profile.kids.map((kid) => kid.name).join(", ")} 🧸`
            : "Welcome to Little Luxe 🧸"}
        </p>

        <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <li
                key={chip.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-white/4 px-3 py-1.5 text-xs text-muted-foreground",
                )}
              >
                <Icon aria-hidden className="size-3.5 text-primary" />
                {chip.label}
              </li>
            );
          })}
        </ul>

        {profile.kids.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            🎂 {profile.kids[0]?.name} turns a year older on{" "}
            {formatMonthYear(profile.kids[0]?.birthday ?? "")} — we&apos;ll remind you before the
            big day.
          </p>
        )}
      </div>
    </section>
  );
}
