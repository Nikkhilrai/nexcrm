import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <Loader2
        className={cn("animate-spin text-slate-400", SIZE[size], className)}
        aria-hidden
      />
      {label && (
        <span className="text-sm text-slate-500" role="status">
          {label}
        </span>
      )}
    </div>
  );
}
