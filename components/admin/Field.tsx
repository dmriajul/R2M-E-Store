import { cn } from "@/lib/utils";

/**
 * Console form primitives.
 *
 * Deliberately tighter than the storefront: denser labels, smaller controls and
 * a blue focus ring, because admins scan forms rather than admire them.
 */

export const adminInputClass =
  "h-10 w-full rounded-lg border border-[#2A2A2A] bg-[#151515] text-sm text-foreground transition-colors duration-200 placeholder:text-muted-foreground/60 focus-visible:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:outline-none aria-invalid:border-rose/60 aria-invalid:focus-visible:ring-rose/20";

export const adminSelectClass = cn(adminInputClass, "px-2.5");

export const adminCardClass =
  "rounded-xl border border-[#242424] bg-[#141414] transition-colors duration-200";

export const adminButtonBlue =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const adminButtonGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] bg-transparent px-4 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

interface AdminFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Compact label + control + inline error. */
export function AdminField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: AdminFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

interface AdminPanelProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** Section card used across the console pages. */
export function AdminPanel({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: AdminPanelProps) {
  return (
    <section className={cn(adminCardClass, "p-5", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Section heading inside a form (e.g. "Basic info", "Pricing"). */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("border-t border-[#242424] pt-5 first:border-t-0 first:pt-0", className)}>
      <legend className="sr-only">{title}</legend>
      <p className="text-[11px] font-semibold tracking-[0.16em] text-blue-400 uppercase">
        {title}
      </p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
