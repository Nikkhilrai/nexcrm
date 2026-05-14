"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Calendar, MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react";

import { Badge, Button, Card, Spinner } from "@/components/ui";
import {
  api,
  type AdminUser,
  type Event as ApiEvent,
  type EventWithPipelines,
  type EventVisibilityUser,
  type NestedSubPipeline,
  type NestedTier,
  type PackageTier,
  type SubPipeline,
} from "@/lib/api";

import { EventFormModal } from "./components/EventFormModal";
import { SubPipelineFormModal } from "./components/SubPipelineFormModal";
import { TierFormModal } from "./components/TierFormModal";

/**
 * Admin-only 3-level CMS — Event → SubPipeline → Tier. Each level is
 * created, edited, deactivated, or hard-deleted (FK PROTECT 400 hint
 * surfaces if leads/tiers still attached). Backend `?with_pipelines=true`
 * returns the entire tree in one request so the page mutates a single
 * tree state instead of juggling per-level lists.
 */
export default function AdminPipelinesPage() {
  const [tree, setTree] = useState<EventWithPipelines[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Modal state — at most one open at a time. Each carries the right
  // scope context (Event/SubPipeline/initial-row).
  const [eventModal, setEventModal] = useState<{ open: boolean; initial: ApiEvent | null }>({
    open: false,
    initial: null,
  });
  const [spModal, setSpModal] = useState<{
    open: boolean;
    initial: SubPipeline | null;
    event: ApiEvent | null;
  }>({ open: false, initial: null, event: null });
  const [tierModal, setTierModal] = useState<{
    open: boolean;
    initial: PackageTier | null;
    subPipeline: SubPipeline | null;
  }>({ open: false, initial: null, subPipeline: null });

  function load() {
    setError(null);
    api.events
      .listWithPipelines()
      .then(setTree)
      .catch((e: unknown) => {
        if (axios.isAxiosError(e) && !e.response) setError("Can't reach the server.");
        else if (axios.isAxiosError(e) && e.response?.status === 403) setError("Admin only.");
        else setError("Couldn't load pipelines.");
      });
  }

  useEffect(() => {
    load();
    api.users.list().then(setUsers).catch(() => {});
  }, []);

  // Refetch the entire tree after every successful write. The endpoint
  // is small + admins act infrequently, so this is cheaper than weaving
  // in-place updates through three nested arrays.
  function reloadAndCloseAll() {
    setEventModal({ open: false, initial: null });
    setSpModal({ open: false, initial: null, event: null });
    setTierModal({ open: false, initial: null, subPipeline: null });
    load();
  }

  function alertDeleteError(e: unknown, fallback: string) {
    const msg =
      axios.isAxiosError(e) && e.response?.data && typeof e.response.data === "object"
        ? "detail" in e.response.data
          ? String((e.response.data as { detail: unknown }).detail)
          : `${e.response.status}`
        : fallback;
    window.alert(msg);
  }

  async function deleteEvent(ev: ApiEvent) {
    if (!window.confirm(`Delete event "${ev.name}"?\n\nThis removes the event AND every sub-pipeline + tier under it. Leads attached to this event will block the delete.`)) return;
    setBusy(`event-${ev.id}`);
    try {
      await api.events.remove(ev.id);
      load();
    } catch (e) {
      alertDeleteError(e, "Couldn't delete event. Deactivate it instead?");
    } finally {
      setBusy(null);
    }
  }

  async function deleteSubPipeline(sp: NestedSubPipeline) {
    if (!window.confirm(`Delete sub-pipeline "${sp.name}"?\n\nLeads still attached will block the delete (deactivate instead).`)) return;
    setBusy(`sp-${sp.id}`);
    try {
      await api.subPipelines.remove(sp.id);
      load();
    } catch (e) {
      alertDeleteError(e, "Couldn't delete sub-pipeline.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTier(t: NestedTier) {
    if (!window.confirm(`Delete tier "${t.name}"?\n\nLeads still attached will block the delete (deactivate instead).`)) return;
    setBusy(`tier-${t.id}`);
    try {
      await api.tiers.remove(t.id);
      load();
    } catch (e) {
      alertDeleteError(e, "Couldn't delete tier.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleEventActive(ev: ApiEvent) {
    setBusy(`event-${ev.id}`);
    try {
      await api.events.update(ev.id, { is_active: !ev.is_active });
      load();
    } catch {
      window.alert("Couldn't update event.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSpActive(sp: NestedSubPipeline) {
    setBusy(`sp-${sp.id}`);
    try {
      await api.subPipelines.update(sp.id, { is_active: !sp.is_active });
      load();
    } catch {
      window.alert("Couldn't update sub-pipeline.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleTierActive(t: NestedTier) {
    setBusy(`tier-${t.id}`);
    try {
      await api.tiers.update(t.id, { is_active: !t.is_active });
      load();
    } catch {
      window.alert("Couldn't update tier.");
    } finally {
      setBusy(null);
    }
  }

  async function handleVisibilityChange(ev: ApiEvent, userIds: number[]) {
    setBusy(`visibility-${ev.id}`);
    try {
      await api.events.update(ev.id, { visible_to: userIds });
      load();
    } catch {
      window.alert("Couldn't update event visibility.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink-900">Pipelines</h1>
          <p className="text-sm text-slate-600">
            The whole hierarchy — Events → Sub-pipelines → Tiers — is admin-managed here.
            Lead-form dropdowns and master filters are powered by what's active below.
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setEventModal({ open: true, initial: null })}
        >
          New event
        </Button>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      ) : tree === null ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading pipelines…" />
        </div>
      ) : tree.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500 italic">
          No events yet. Click <strong>New event</strong> above to start.
        </div>
      ) : (
        <div className="space-y-5">
          {tree.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              busyId={busy}
              allUsers={users}
              onVisibilityChange={(ids) => handleVisibilityChange(ev, ids)}
              onEditEvent={() => setEventModal({ open: true, initial: ev })}
              onDeleteEvent={() => deleteEvent(ev)}
              onToggleEventActive={() => toggleEventActive(ev)}
              onAddSp={() => setSpModal({ open: true, initial: null, event: ev })}
              onEditSp={(sp) =>
                setSpModal({
                  open: true,
                  initial: nestedToFlatSp(sp, ev.id),
                  event: ev,
                })
              }
              onDeleteSp={deleteSubPipeline}
              onToggleSpActive={toggleSpActive}
              onAddTier={(sp) =>
                setTierModal({
                  open: true,
                  initial: null,
                  subPipeline: nestedToFlatSp(sp, ev.id),
                })
              }
              onEditTier={(sp, t) =>
                setTierModal({
                  open: true,
                  initial: nestedToFlatTier(t, sp.id),
                  subPipeline: nestedToFlatSp(sp, ev.id),
                })
              }
              onDeleteTier={deleteTier}
              onToggleTierActive={toggleTierActive}
            />
          ))}
        </div>
      )}

      <EventFormModal
        open={eventModal.open}
        initial={eventModal.initial}
        onClose={() => setEventModal({ open: false, initial: null })}
        onSaved={reloadAndCloseAll}
      />
      <SubPipelineFormModal
        open={spModal.open}
        initial={spModal.initial}
        event={spModal.event}
        onClose={() => setSpModal({ open: false, initial: null, event: null })}
        onSaved={reloadAndCloseAll}
      />
      <TierFormModal
        open={tierModal.open}
        initial={tierModal.initial}
        subPipeline={tierModal.subPipeline}
        onClose={() => setTierModal({ open: false, initial: null, subPipeline: null })}
        onSaved={reloadAndCloseAll}
      />
    </div>
  );
}

/* ─── Per-event card ─────────────────────────────────────────────────── */

interface EventCardProps {
  event: EventWithPipelines;
  busyId: string | null;
  allUsers: AdminUser[];
  onVisibilityChange: (userIds: number[]) => void;
  onEditEvent: () => void;
  onDeleteEvent: () => void;
  onToggleEventActive: () => void;
  onAddSp: () => void;
  onEditSp: (sp: NestedSubPipeline) => void;
  onDeleteSp: (sp: NestedSubPipeline) => void;
  onToggleSpActive: (sp: NestedSubPipeline) => void;
  onAddTier: (sp: NestedSubPipeline) => void;
  onEditTier: (sp: NestedSubPipeline, t: NestedTier) => void;
  onDeleteTier: (t: NestedTier) => void;
  onToggleTierActive: (t: NestedTier) => void;
}

function EventCard({
  event,
  busyId,
  allUsers,
  onVisibilityChange,
  onEditEvent,
  onDeleteEvent,
  onToggleEventActive,
  onAddSp,
  onEditSp,
  onDeleteSp,
  onToggleSpActive,
  onAddTier,
  onEditTier,
  onDeleteTier,
  onToggleTierActive,
}: EventCardProps) {
  const eventBusy = busyId === `event-${event.id}`;
  return (
    <Card padding="none">
      <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-heading text-ink-900 truncate">{event.name}</h2>
            <button
              type="button"
              onClick={onToggleEventActive}
              disabled={eventBusy}
              className="cursor-pointer disabled:opacity-50"
              title={event.is_active ? "Click to deactivate" : "Click to reactivate"}
            >
              <Badge tone={event.is_active ? "emerald" : "neutral"}>
                {event.is_active ? "Active" : "Inactive"}
              </Badge>
            </button>
          </div>
          <div className="mt-1 text-xs text-slate-500 inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {event.city}, {event.country}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {event.start_date} → {event.end_date}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onAddSp}
          >
            Sub-pipeline
          </Button>
          <button
            onClick={onEditEvent}
            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Edit event"
            title="Edit event"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDeleteEvent}
            disabled={eventBusy}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Delete event"
            title="Delete event"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <VisibilityRow
        assignedUsers={event.visible_to_users}
        allUsers={allUsers}
        busy={busyId === `visibility-${event.id}`}
        onVisibilityChange={onVisibilityChange}
      />

      {event.sub_pipelines.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-slate-500 italic">
          No sub-pipelines yet — click <strong>+ Sub-pipeline</strong> above to add one.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {event.sub_pipelines.map((sp) => (
            <SubPipelineRow
              key={sp.id}
              sp={sp}
              busyId={busyId}
              onEdit={() => onEditSp(sp)}
              onDelete={() => onDeleteSp(sp)}
              onToggleActive={() => onToggleSpActive(sp)}
              onAddTier={() => onAddTier(sp)}
              onEditTier={(t) => onEditTier(sp, t)}
              onDeleteTier={onDeleteTier}
              onToggleTierActive={onToggleTierActive}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface SubPipelineRowProps {
  sp: NestedSubPipeline;
  busyId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddTier: () => void;
  onEditTier: (t: NestedTier) => void;
  onDeleteTier: (t: NestedTier) => void;
  onToggleTierActive: (t: NestedTier) => void;
}

function SubPipelineRow({
  sp,
  busyId,
  onEdit,
  onDelete,
  onToggleActive,
  onAddTier,
  onEditTier,
  onDeleteTier,
  onToggleTierActive,
}: SubPipelineRowProps) {
  const spBusy = busyId === `sp-${sp.id}`;
  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-medium text-ink-900 truncate">{sp.name}</h3>
          <span className="text-xs text-slate-400 font-mono">{sp.slug}</span>
          <button
            type="button"
            onClick={onToggleActive}
            disabled={spBusy}
            className="cursor-pointer disabled:opacity-50"
            title={sp.is_active ? "Click to deactivate" : "Click to reactivate"}
          >
            <Badge tone={sp.is_active ? "emerald" : "neutral"}>
              {sp.is_active ? "Active" : "Inactive"}
            </Badge>
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onAddTier}
          >
            Tier
          </Button>
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Edit sub-pipeline"
            title="Edit sub-pipeline"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={spBusy}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Delete sub-pipeline"
            title="Delete sub-pipeline"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {sp.tiers.length === 0 ? (
        <div className="mt-2 ml-6 text-xs text-slate-500 italic">
          No tiers yet.
        </div>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
            <tr>
              <th className="text-left font-semibold py-1.5 w-16">Order</th>
              <th className="text-left font-semibold py-1.5">Name</th>
              <th className="text-left font-semibold py-1.5">Prices (₹ / $)</th>
              <th className="text-left font-semibold py-1.5 w-24">Status</th>
              <th className="w-20" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sp.tiers.map((t) => {
              const tierBusy = busyId === `tier-${t.id}`;
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-2 text-slate-500 font-mono text-xs">{t.sort_order}</td>
                  <td className="py-2 font-medium text-ink-900">{t.name}</td>
                  <td className="py-2 text-slate-700 text-sm">
                    <span>
                      {t.default_price_inr
                        ? `₹${Number(t.default_price_inr).toLocaleString()}`
                        : <span className="text-slate-400">—</span>}
                    </span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span>
                      {t.default_price_usd
                        ? `$${Number(t.default_price_usd).toLocaleString()}`
                        : <span className="text-slate-400">—</span>}
                    </span>
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onToggleTierActive(t)}
                      disabled={tierBusy}
                      className="cursor-pointer disabled:opacity-50"
                      title={t.is_active ? "Click to deactivate" : "Click to reactivate"}
                    >
                      <Badge tone={t.is_active ? "emerald" : "neutral"}>
                        {t.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onEditTier(t)}
                        className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                        aria-label="Edit tier"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTier(t)}
                        disabled={tierBusy}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Delete tier"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── Visibility row ─────────────────────────────────────────────────── */

function VisibilityRow({
  assignedUsers,
  allUsers,
  busy,
  onVisibilityChange,
}: {
  assignedUsers: EventVisibilityUser[];
  allUsers: AdminUser[];
  busy: boolean;
  onVisibilityChange: (userIds: number[]) => void;
}) {
  const assignedIds = new Set(assignedUsers.map((u) => u.id));
  // Only non-admin active users appear in the picker — admins always see everything.
  const available = allUsers.filter(
    (u) => u.role !== "ADMIN" && u.is_active && !assignedIds.has(u.id),
  );

  function remove(userId: number) {
    onVisibilityChange(assignedUsers.filter((u) => u.id !== userId).map((u) => u.id));
  }

  function add(userId: number) {
    onVisibilityChange([...assignedUsers.map((u) => u.id), userId]);
  }

  return (
    <div className="px-6 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap bg-slate-50/60">
      <span className="text-xs font-medium text-slate-500 shrink-0 inline-flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        Visible to
      </span>

      {assignedUsers.length === 0 ? (
        <span className="text-xs text-slate-400 italic">All users — unrestricted</span>
      ) : (
        assignedUsers.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 ring-1 ring-brand-200 text-xs px-2 py-0.5 rounded-full"
          >
            {u.username}
            <button
              type="button"
              onClick={() => remove(u.id)}
              disabled={busy}
              className="hover:text-rose-500 disabled:opacity-40 leading-none"
              aria-label={`Remove ${u.username}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))
      )}

      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) add(Number(e.target.value)); }}
          disabled={busy}
          className="text-xs border border-slate-200 rounded px-2 py-0.5 text-slate-600 bg-white cursor-pointer disabled:opacity-40 hover:border-slate-300"
        >
          <option value="">+ Add user…</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
      )}

      {assignedUsers.length > 0 && (
        <button
          type="button"
          onClick={() => onVisibilityChange([])}
          disabled={busy}
          className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40 ml-auto"
          title="Remove all restrictions — make event visible to everyone"
        >
          Clear restrictions
        </button>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** The `?with_pipelines=true` payload uses a brief shape (no event/created_at).
 *  Modals expect the full `SubPipeline`. Fill missing fields with placeholders;
 *  modals only read id/event/name/sort_order/is_active for edit-mode prefill. */
function nestedToFlatSp(sp: NestedSubPipeline, eventId: number): SubPipeline {
  return {
    id: sp.id,
    event: eventId,
    name: sp.name,
    slug: sp.slug,
    is_active: sp.is_active,
    sort_order: sp.sort_order,
    created_at: "",
    updated_at: "",
  };
}

function nestedToFlatTier(t: NestedTier, subPipelineId: number): PackageTier {
  return {
    id: t.id,
    sub_pipeline: subPipelineId,
    name: t.name,
    default_price_inr: t.default_price_inr,
    default_price_usd: t.default_price_usd,
    is_active: t.is_active,
    sort_order: t.sort_order,
    created_at: "",
    updated_at: "",
  };
}
