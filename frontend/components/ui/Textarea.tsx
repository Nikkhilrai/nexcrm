import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, className, id, ...rest }, ref) {
    const textareaId = id ?? rest.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "w-full px-3 py-2 bg-white text-sm text-slate-900",
            "border rounded-md transition resize-y min-h-[80px]",
            "placeholder:text-slate-400",
            "focus:outline-none focus:ring-2",
            error
              ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-500"
              : "border-slate-300 focus:ring-brand-500/40 focus:border-brand-500",
            "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
            className,
          )}
          {...rest}
        />
        {(error || hint) && (
          <p className={cn("text-xs mt-1", error ? "text-rose-600" : "text-slate-500")}>
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);
