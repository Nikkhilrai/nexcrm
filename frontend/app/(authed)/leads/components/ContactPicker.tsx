"use client";

import { useEffect, useState } from "react";
import { Search, UserCircle2, X } from "lucide-react";

import { Card, Input, Spinner } from "@/components/ui";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { api, type Contact } from "@/lib/api";

export interface ContactPickerProps {
  picked: Contact | null;
  onPick: (contact: Contact) => void;
  onClear: () => void;
}

/** Typeahead search over /api/contacts/?search=. Selecting a contact passes
 *  it back via `onPick`; the parent form copies the contact's fields onto
 *  the lead form (snapshot semantics — Lead is not FK-linked to Contact).
 */
export function ContactPicker({ picked, onPick, onClear }: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<Contact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (picked) {
      setResults(null);
      return;
    }
    const q = debounced.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.contacts
      .list({ search: q })
      .then((res) => {
        if (!cancelled) setResults(res.results);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, picked]);

  if (picked) {
    return (
      <Card padding="tight">
        <div className="flex items-center gap-3">
          <UserCircle2 className="w-5 h-5 text-brand-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-900 truncate">
              Pre-filled from contact: {picked.full_name || "(no name)"}
            </div>
            <div className="text-xs text-slate-500 font-mono truncate">
              {picked.phone}
              {picked.company ? ` · ${picked.company}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Clear picked contact"
            title="Clear — fields stay editable, but no longer linked to a contact."
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Pick from contacts" description="Optional — search the contacts database to pre-fill name, phone, email, company, designation, LinkedIn, source.">
      <div className="relative">
        <Input
          name="contact-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type a name, phone, or email…"
          leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          autoComplete="off"
        />
        {open && debounced.trim().length >= 2 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto">
            {loading ? (
              <div className="px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
                <Spinner size="sm" /> Searching…
              </div>
            ) : results && results.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {results.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(c);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-ink-900">
                        {c.full_name || <span className="italic text-slate-500">(no name)</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {c.phone}
                        {c.company ? ` · ${c.company}` : ""}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-slate-500 italic">
                No matching contacts. The form below stays usable — a new contact will be created automatically when you save.
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
