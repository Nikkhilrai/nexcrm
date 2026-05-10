"use client";

import { LayoutGrid, List } from "lucide-react";

import { cn } from "@/lib/cn";

export type HomeView = "board" | "list";

export interface ViewToggleProps {
  value: HomeView;
  onChange: (next: HomeView) => void;
}

/**
 * Segmented `Board | List` toggle for the Master home page. Renders top-right.
 *
 * The same visual treatment as the Phase 2.5 in-board toggle so muscle memory
 * carries over. ARIA `tablist` semantics so screen readers announce the
 * active view.
 */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "board"}
        onClick={() => onChange("board")}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          value === "board"
            ? "bg-brand-50 text-brand-700"
            : "text-slate-600 hover:text-slate-900",
        )}
      >
        <LayoutGrid className="w-4 h-4" />
        Board
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          value === "list"
            ? "bg-brand-50 text-brand-700"
            : "text-slate-600 hover:text-slate-900",
        )}
      >
        <List className="w-4 h-4" />
        List
      </button>
    </div>
  );
}
