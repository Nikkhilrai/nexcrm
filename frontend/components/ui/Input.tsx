import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2 bg-white text-sm text-slate-900",
            "border rounded-md transition",
            "placeholder:text-slate-400",
            "focus:outline-none focus:ring-2",
            error
              ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-500"
              : "border-slate-300 focus:ring-brand-500/40 focus:border-brand-500",
            "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
            leftIcon && "pl-9",
            className,
          )}
          {...rest}
        />
      </div>
      {(error || hint) && (
        <p className={cn("text-xs mt-1", error ? "text-rose-600" : "text-slate-500")}>
          {error || hint}
        </p>
      )}
    </div>
  );
});
