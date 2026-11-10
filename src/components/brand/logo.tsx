import { cn } from "@/lib/utils";

/**
 * JADARAH symbol — "Revealed Merit".
 * Three ascending slabs (layers of capability rising into view) and a diamond:
 * the evidence point that turns potential into proof. The diamond also echoes
 * the dot of the Arabic letter ج. Geometry is shared with /public/brand/*.svg.
 */
export function LogoMark({
  className,
  tone = "auto",
  title,
}: {
  className?: string;
  tone?: "auto" | "light" | "dark" | "mono";
  title?: string;
}) {
  const base = tone === "dark" ? "#F8F6F0" : tone === "light" ? "#0F1B3D" : "currentColor";
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M8 32h22l-6 10H2z" fill={base} />
      <path d="M14 19h22l-6 10H8z" fill={tone === "mono" ? base : "#3B66F6"} />
      <path d="M20 6h22l-6 10H14z" fill={tone === "mono" ? base : "#A9B8FF"} />
      <path d="M40 30l6 6-6 6-6-6z" fill={tone === "mono" ? base : "#3B66F6"} />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)} aria-label="JADARAH | جدارة">
      <LogoMark className="size-8" />
      {!compact && (
        <span className="flex flex-col leading-none" aria-hidden>
          <span className="font-arabic text-[1.15rem] font-bold">جدارة</span>
          <span className="font-sans text-[0.62rem] font-extrabold tracking-[0.32em] text-muted">JADARAH</span>
        </span>
      )}
    </span>
  );
}
