import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  padding?: "default" | "tight" | "none";
}

const PADDING: Record<NonNullable<CardProps["padding"]>, string> = {
  default: "p-6",
  tight: "p-4",
  none: "",
};

export function Card({
  title,
  description,
  action,
  padding = "default",
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = Boolean(title || description || action);
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-xl shadow-sm",
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-start justify-between gap-4",
            padding === "none" ? "px-6 pt-6" : padding === "tight" ? "p-4 pb-0" : "p-6 pb-0",
          )}
        >
          <div>
            {title && (
              <h3 className="font-heading text-lg text-ink-900">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-slate-600 mt-1">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn(PADDING[padding], hasHeader && padding !== "none" && "pt-4")}>
        {children}
      </div>
    </div>
  );
}
