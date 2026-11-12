import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import type { StatusTone } from "@/lib/domain/application-status";

/** Tonal surfaces carry meaning: blue = opportunity/primary metric, sage = done/positive, peach = needs action,
 * mist = growth/skills, sand = neutral context, teal = secondary insight, lilac = rare decorative accent. */
export type CardTone = "blue" | "mist" | "sand" | "peach" | "sage" | "teal" | "lilac";

export function Card({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return <div className={cn("surface-card", className)} data-tone={tone} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0", className)}>
      <div className="min-w-0">
        <h2 className="text-[0.95rem] font-bold tracking-tight">{title}</h2>
        {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

const toneClasses: Record<StatusTone | "accent", string> = {
  neutral: "bg-surface-2 text-foreground",
  info: "bg-info-soft text-info",
  progress: "bg-tone-mist text-[var(--tone-mist-ink)]",
  positive: "bg-success-soft text-success",
  negative: "bg-danger-soft text-danger",
  muted: "bg-surface-2 text-muted",
  accent: "bg-primary text-primary-foreground",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: StatusTone | "accent";
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const text =
    parts
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "؟";
  return (
    <span
      aria-hidden
      className={cn(
        "bg-tone-mist text-[var(--tone-mist-ink)] ring-border inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1",
        className,
      )}
    >
      {text}
    </span>
  );
}

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn("bg-surface-2 h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className="fill-signature bg-primary h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="jd-enter mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="editorial text-[1.9rem] font-bold sm:text-[2.4rem]">{title}</h1>
        {description && <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed sm:text-[0.95rem]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="bg-violet-soft mb-4 grid size-14 place-items-center rounded-2xl" aria-hidden>
        <Inbox className="text-violet-ink size-6" />
      </span>
      <h3 className="text-[0.95rem] font-bold">{title}</h3>
      {body && <p className="text-muted mt-1 max-w-sm text-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** KPI tile: value with label, optional hint; tone colours the tile by meaning. */
export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: CardTone;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card tone={tone} className={cn("flex flex-col gap-1.5 p-4 sm:p-5", className)}>
      <span className="tone-ink flex items-center gap-1.5 text-xs font-semibold">
        {icon}
        {label}
      </span>
      <span className="ltr-nums self-start text-[1.75rem] leading-none font-extrabold tracking-tight sm:text-[2rem]">
        {value}
      </span>
      {hint && <span className="text-subtle text-xs">{hint}</span>}
    </Card>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-muted text-xs font-semibold">{label}</span>
      <span className="ltr-nums self-start text-[1.75rem] leading-none font-extrabold tracking-tight">{value}</span>
      {hint && <span className="text-subtle text-xs">{hint}</span>}
    </div>
  );
}

/**
 * Spotlight: the opening composition of each workspace overview — the few figures that matter, on a calm ground that
 * differs per role (no background graphics behind content):
 *   candidate — luminous indigo with violet light: a personal, career-focused space
 *   employer  — deep green brand panel with mint light: the organisation's command view
 *   admin     — a lavender-lit operations band, denser and calmer for scanning
 */
export function Spotlight({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  variant = "candidate",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: "candidate" | "employer" | "admin";
}) {
  const skin =
    variant === "employer"
      ? "panel-green"
      : variant === "admin"
        ? "section-lavender border"
        : "ink ink-aura";
  return (
    <section
      className={cn(
        "jd-enter relative isolate overflow-hidden rounded-[1.75rem]",
        variant === "admin" ? "p-5 sm:p-6" : "p-6 sm:p-8",
        skin,
        className,
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && (
            <p className={cn("mb-2 text-xs font-semibold", variant === "admin" ? "eyebrow" : "text-subtle")}>{eyebrow}</p>
          )}
          <h1
            className={cn(
              "editorial font-extrabold",
              variant === "admin" ? "text-[1.6rem] sm:text-[1.9rem]" : "text-[1.9rem] sm:text-[2.5rem]",
            )}
          >
            {title}
          </h1>
          {description && <p className="text-muted mt-2 text-sm leading-relaxed sm:text-[0.95rem]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className={variant === "admin" ? "mt-5" : "mt-7"}>{children}</div>}
    </section>
  );
}

/**
 * A metric inside a Spotlight. "tile" (candidate/employer) is a soft lifted block; "inline" (admin) separates figures
 * with hairlines instead of boxes, so dense numbers stay calm.
 */
export function SpotlightStat({
  label,
  value,
  hint,
  emphasis,
  look = "tile",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Marks the figure that needs attention (e.g. pending actions). */
  emphasis?: boolean;
  look?: "tile" | "inline";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        look === "tile"
          ? "bg-surface/80 rounded-2xl border border-white/10 p-4"
          : "border-border border-s ps-4 first:border-s-0 first:ps-0",
      )}
    >
      <span className="text-muted flex items-center gap-1.5 text-xs font-semibold">
        {emphasis && <span className="size-1.5 rounded-full bg-[var(--gold)]" aria-hidden />}
        {label}
      </span>
      <span className="editorial ltr-nums self-start text-[1.9rem] leading-none font-bold tracking-tight sm:text-[2.2rem]">
        {value}
      </span>
      {hint && <span className="text-subtle text-xs">{hint}</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("jd-skeleton", className)} aria-hidden />;
}
