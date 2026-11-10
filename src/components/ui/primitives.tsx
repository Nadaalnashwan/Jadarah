import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/domain/application-status";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card", className)} {...props} />;
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
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
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
  info: "bg-sky-soft text-navy dark:text-sky",
  progress: "bg-accent-soft text-royal-700 text-primary dark:text-lavender",
  positive: "bg-success-soft text-success",
  negative: "bg-danger-soft text-danger",
  muted: "bg-surface-2 text-subtle",
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
  const text = parts.map((p) => p[0]).join("").toUpperCase() || "؟";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lavender to-sky text-xs font-bold text-navy",
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
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-royal to-lavender transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)] rtl:bg-gradient-to-l"
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
        {description && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{description}</p>}
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
      <svg viewBox="0 0 64 48" className="mb-5 h-12 w-16" aria-hidden>
        <path d="M24 6h30l-8 12H16z" fill="var(--lavender)" opacity=".55" />
        <path d="M16 20h30l-8 12H8z" fill="var(--royal)" opacity=".35" />
        <path d="M8 34h30l-8 12H0z" fill="var(--navy)" opacity=".18" />
        <path d="M56 32l6 6-6 6-6-6z" fill="var(--royal)" />
      </svg>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
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
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="ltr-nums text-3xl font-extrabold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </div>
  );
}
