import { cn } from "@/lib/utils";

interface PagePlaceholderProps {
  /** Small gold eyebrow label above the title. */
  eyebrow: string;
  title: string;
  description: string;
  /** Full-bleed route segment shown in the footer of the panel. */
  path: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Temporary scaffold used by every route until the real sections are built.
 * It exists so each page can be visited and the layout shell verified.
 */
export function PagePlaceholder({
  eyebrow,
  title,
  description,
  path,
  children,
  className,
}: PagePlaceholderProps) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32",
        className,
      )}
    >
      <div className="glass glow-gold relative overflow-hidden rounded-3xl px-6 py-16 sm:px-12 sm:py-20">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="text-gradient-gold mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>

        {children}

        <div className="mt-10 flex flex-wrap items-center gap-3 text-xs tracking-[0.2em] text-muted-foreground/80 uppercase">
          <span className="rounded-full border border-glass-border px-3 py-1">
            Scaffold
          </span>
          <span className="font-mono normal-case">{path}</span>
        </div>
      </div>
    </section>
  );
}
