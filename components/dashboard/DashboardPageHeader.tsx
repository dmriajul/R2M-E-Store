import { cn } from "@/lib/utils";

interface DashboardPageHeaderProps {
  title: string;
  emoji?: string;
  description?: string;
  /** Buttons / links rendered on the right on wide screens, below on phones. */
  actions?: React.ReactNode;
  className?: string;
}

/** Shared page title block for every account screen. */
export function DashboardPageHeader({
  title,
  emoji,
  description,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {title}
          {emoji && (
            <>
              {" "}
              <span aria-hidden className="emoji-pop">
                {emoji}
              </span>
            </>
          )}
        </h1>
        {description && (
          <p className="prose-kids mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
