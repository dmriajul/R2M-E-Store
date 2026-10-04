"use client";

import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { NotificationsList } from "@/components/dashboard/NotificationsList";
import { selectUnreadCount, useDashboardStore } from "@/store/useDashboardStore";
import { Button } from "@/components/ui/button";

export default function DashboardNotificationsPage() {
  const unread = useDashboardStore(selectUnreadCount);
  const markAllRead = useDashboardStore((state) => state.markAllNotificationsRead);

  return (
    <>
      <title>Notifications | LITTLE LUXE</title>
      <meta
        name="description"
        content="Order updates, sale alerts and birthday reminders from Little Luxe."
      />
      <meta name="robots" content="noindex" />

      <DashboardPageHeader
        title="Notifications"
        emoji="🔔"
        description={
          unread > 0
            ? `${unread} unread ${unread === 1 ? "update" : "updates"} waiting for you.`
            : "You're all caught up — deliveries, sales and birthday nudges land here."
        }
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={unread === 0}
            onClick={() => {
              markAllRead();
              toast.success("All notifications marked as read ✅");
            }}
            className="h-11 rounded-full border-glass-border bg-glass px-5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        }
      />

      <NotificationsList />
    </>
  );
}
