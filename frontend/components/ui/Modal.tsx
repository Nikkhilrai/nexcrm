"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Native <dialog>-based modal. Gets:
 *   - ESC to close (built-in)
 *   - Backdrop click to close (we wire it explicitly)
 *   - Focus trap (built-in via showModal)
 *   - Portaled to top-layer (no z-index gymnastics)
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Backdrop click — the click target is the dialog itself when the user
        // clicks outside the inner panel.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "p-0 m-auto rounded-2xl shadow-2xl bg-white",
        "backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm",
        SIZE[size],
        "w-full",
      )}
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-2">
        <div>
          {title && <h2 className="font-heading text-xl text-ink-900">{title}</h2>}
          {description && (
            <p className="text-sm text-slate-600 mt-1">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 -mr-1 -mt-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {footer}
        </div>
      )}
    </dialog>
  );
}
