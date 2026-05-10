"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="font-heading text-2xl text-ink-900 mt-4">Something broke.</h1>
        <p className="text-sm text-slate-600 mt-2">
          An unexpected error stopped this page from rendering. Try again, or head
          back to leads.
        </p>
        {error.message && (
          <p className="text-xs font-mono text-slate-500 mt-3 bg-slate-50 border border-slate-200 rounded px-2 py-1 break-all">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="secondary" onClick={() => (window.location.href = "/leads")}>
            Go to leads
          </Button>
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </main>
  );
}
