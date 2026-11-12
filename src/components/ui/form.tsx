import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-[0.625rem] border border-border-strong bg-input px-3.5 text-sm text-foreground placeholder:text-subtle transition-[border-color,box-shadow] duration-150 hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(fieldBase, "h-11 w-full appearance-none pe-9")} {...props}>
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        className="text-subtle pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-foreground text-sm font-semibold", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-danger ms-0.5" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-subtle text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("border-border-strong size-4 shrink-0 rounded accent-[var(--royal)]", className)}
      {...props}
    />
  );
}

export function FormMessage({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "success" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    info: "bg-sky-soft text-foreground",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("jd-enter rounded-[0.625rem] px-4 py-3 text-sm font-medium", tones[tone])}
    >
      {children}
    </div>
  );
}
