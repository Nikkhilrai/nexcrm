"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, UserCog, UserX, UserCheck, Trash2 } from "lucide-react";

import { Badge, Button, Card, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { api, type AdminUser } from "@/lib/api";

import { UserFormModal } from "./components/UserFormModal";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setError(null);
    setUsers(null);
    api.users
      .list()
      .then(setUsers)
      .catch((e: unknown) => {
        if (axios.isAxiosError(e) && !e.response) {
          setError("Can't reach the server.");
        } else if (axios.isAxiosError(e) && e.response?.status === 403) {
          setError("Admin only.");
        } else {
          setError("Couldn't load users.");
        }
      });
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setModalOpen(true);
  }

  function handleSaved(saved: AdminUser) {
    setModalOpen(false);
    setUsers((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((u) => u.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
  }

  async function deleteUser(u: AdminUser) {
    if (
      !window.confirm(
        `Permanently delete "${u.username}"?\n\nTheir leads will stay in the system but will be unassigned. This cannot be undone.`,
      )
    ) return;
    setDeletingId(u.id);
    try {
      await api.users.delete(u.id);
      setUsers((prev) => prev ? prev.filter((x) => x.id !== u.id) : prev);
    } catch {
      window.alert("Couldn't delete user.");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(u: AdminUser) {
    const verb = u.is_active ? "deactivate" : "reactivate";
    if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${u.username}?`)) {
      return;
    }
    setTogglingId(u.id);
    try {
      const updated = await api.users.update(u.id, { is_active: !u.is_active });
      setUsers((prev) =>
        prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev,
      );
    } catch {
      window.alert(`Couldn't ${verb} user.`);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink-900">Users</h1>
          <p className="text-sm text-slate-600">
            Create accounts, flip roles, and deactivate without losing audit history.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          New user
        </Button>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      ) : users === null ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading users…" />
        </div>
      ) : users.length === 0 ? (
        <Card title="No users yet" description="Hit '+ New user' to add one." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">User</th>
                  <th className="text-left font-semibold px-4 py-3">Email</th>
                  <th className="text-left font-semibold px-4 py-3">Role</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Joined</th>
                  <th className="text-left font-semibold px-4 py-3">Last login</th>
                  <th className="w-32 px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isMe = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900">
                          {u.username}
                          {isMe && (
                            <span className="ml-2 text-[11px] text-slate-500">
                              (you)
                            </span>
                          )}
                        </div>
                        {(u.first_name || u.last_name) && (
                          <div className="text-xs text-slate-500">
                            {u.first_name} {u.last_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{u.email || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={u.role === "ADMIN" ? "amber" : "blue"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.is_active ? "emerald" : "rose"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(u.date_joined)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(u.last_login)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                            aria-label="Edit user"
                            title="Edit"
                          >
                            <UserCog className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={isMe || togglingId === u.id}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={u.is_active ? "Deactivate" : "Reactivate"}
                            title={
                              isMe
                                ? "You can't deactivate yourself"
                                : u.is_active
                                  ? "Deactivate"
                                  : "Reactivate"
                            }
                          >
                            {u.is_active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            disabled={isMe || deletingId === u.id}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Delete user"
                            title={isMe ? "You can't delete yourself" : "Delete permanently"}
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
          </div>
        </Card>
      )}

      <UserFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
