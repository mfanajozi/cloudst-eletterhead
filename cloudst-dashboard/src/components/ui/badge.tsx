import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "gold" | "success" | "warning" | "destructive";
}

const variants: Record<string, string> = {
  default: "bg-charcoal-700 text-white",
  secondary: "bg-charcoal-700 text-white",
  gold: "bg-gold-200 text-charcoal-900",
  success: "bg-emerald-500 text-white",
  warning: "bg-amber-500 text-charcoal-900",
  destructive: "bg-red-500 text-white",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
