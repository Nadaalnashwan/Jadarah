import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
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
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
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
  progress: "bg-tone-blue text-primary-ink",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
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
        "from-sky to-peach text-[#172f49] inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold",
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
      className={cn("bg-surface-2 h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className="from-royal to-teal h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)] rtl:bg-gradient-to-l"
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
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="editorial text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {description && <p className="text-muted mt-2 max-w-2xl text-sm sm:text-base">{description}</p>}
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
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <span className="relative mb-5 grid size-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(169_184_255/0.45),transparent_70%)]" aria-hidden />
        <LogoMark className="relative size-14 opacity-90" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="text-muted mt-1 max-w-sm text-sm">{body}</p>}
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
    <Card tone={tone} className={cn("flex flex-col gap-1 p-4 sm:p-5", className)}>
      <span className="tone-ink flex items-center gap-1.5 text-xs font-semibold">
        {icon}
        {label}
      </span>
      <span className="ltr-nums text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</span>
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
      <span className="ltr-nums text-3xl font-extrabold tracking-tight">{value}</span>
      {hint && <span className="text-subtle text-xs">{hint}</span>}
    </div>
  );
}
