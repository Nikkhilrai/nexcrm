import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6" />
        </div>
        <h1 className="font-heading text-2xl text-ink-900 mt-4">Page not found.</h1>
        <p className="text-sm text-slate-600 mt-2">
          The link is broken or the lead was deleted.
        </p>
        <Link
          href="/leads"
          className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 hover:from-slate-800 hover:to-slate-900 text-white text-sm font-bold tracking-wide transition-all"
        >
          Back to leads
        </Link>
      </div>
    </main>
  );
}
