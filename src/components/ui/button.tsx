import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.625rem] font-semibold transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-[cubic-bezier(.22,1,.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "btn-primary bg-primary text-primary-foreground shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-8px_rgb(var(--shadow-color)/0.55)] hover:bg-primary-hover hover:shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_10px_22px_-10px_rgb(var(--shadow-color)/0.6)]",
        secondary: "bg-foreground text-background hover:opacity-90",
        brand: "btn-brand hover:opacity-90",
        outline: "border border-border-strong bg-surface-elevated/60 hover:border-primary/50 hover:bg-surface-elevated",
        ghost: "bg-transparent hover:bg-surface-2",
        soft: "bg-accent-soft text-primary-ink hover:bg-tone-blue",
        danger: "bg-danger text-danger-soft hover:opacity-90",
        link: "rounded-none px-0 text-primary-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[0.95rem]",
        icon: "size-9 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
