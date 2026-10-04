"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelative } from "@/lib/utils";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { selectUnreadCount, useDashboardStore } from "@/store/useDashboardStore";

/** Notification feed: unread rows get a gold rail and a brighter surface. */
export function NotificationsList() {
  const notifications = useDashboardStore((state) => state.notifications);
  const toggleRead = useDashboardStore((state) => state.toggleNotificationRead);
  const unread = useDashboardStore(selectUnreadCount);

  if (notifications.length === 0) {
    return (
      <div className="glass-soft flex flex-col items-center gap-3 rounded-3xl border border-glass-border px-6 py-14 text-center">
        <span aria-hidden className="text-5xl">
          🎉
        </span>
        <h2 className="text-lg font-bold">All caught up! 🎉</h2>
        <p className="prose-kids max-w-sm text-sm text-muted-foreground">
          No new updates — we&apos;ll ping you the moment something ships or a sale starts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {unread === 0 && (
        <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-300">
          You&apos;re all caught up! 🎉 Everything here has been read.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {notifications.map((notification, index) => {
            const relative = formatRelative(notification.createdAt, DEMO_NOW);

            return (
              <motion.li
                key={notification.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative flex items-start gap-4 overflow-hidden rounded-2xl border-l-2 p-4 transition-colors duration-400 ease-[var(--ease-luxe)]",
                  notification.read
                    ? "border-glass-border border-l-transparent bg-white/2 hover:bg-white/4"
                    : "border-primary/25 border-l-primary bg-white/7 hover:bg-white/9",
                )}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {notification.emoji}
                </span>

                <button
                  type="button"
                  onClick={() => toggleRead(notification.id)}
                  aria-pressed={!notification.read}
                  className="min-w-0 flex-1 cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "block text-sm",
                      notification.read ? "font-medium text-muted-foreground" : "font-semibold text-foreground",
                    )}
                  >
                    {notification.title}
                  </span>
                  {notification.body && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {notification.body}
                    </span>
                  )}
                  <span className="mt-2 block text-[11px] text-muted-foreground">
                    {relative}
                    {!notification.read && " · unread"}
                  </span>
                </button>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {!notification.read && (
                    <span className="size-2 rounded-full bg-primary" aria-hidden />
                  )}
                  {notification.href && (
                    <Link
                      href={notification.href}
                      className="rounded-full text-[11px] font-semibold tracking-[0.14em] text-primary uppercase transition-colors duration-300 hover:text-gold-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
