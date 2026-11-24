"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { getApiErrorMessage, getApiUrl } from "@/utils/api";

interface PoolKey {
  id: string;
  provider: string;
  label: string;
  status: string;
  assigned_user_id: string | null;
  assigned_username: string | null;
  assigned_usernames?: string[];
  assigned_count?: number;
  allow_sharing: boolean;
  masked_key: string;
  created_at: string;
  updated_at: string;
}

interface MissingUser {
  id: string;
  username: string;
  is_admin: boolean;
  created_at?: string | null;
}

interface PoolStatus {
  active_provider: string;
  active_model: string;
  supported: boolean;
  available_unassigned_keys: number;
  total_active_keys: number;
  has_keys: boolean;
  users_missing_keys: MissingUser[];
  error: string | null;
}

interface PoolUser {
  id: string;
  username: string;
  is_admin: boolean;
  has_key: boolean;
  credits?: number;
  free_presentation_used?: boolean;
  has_purchased_credits?: boolean;
}

interface AdminPanelProps {
  embedded?: boolean;
  onBackToSettings?: () => void;
}

const PROVIDERS = [
  { value: "groq", label: "Groq" },
  { value: "qwen", label: "Qwen" },
];

const emptyEditForm = {
  provider: "groq",
  label: "",
  status: "active",
  allow_sharing: false,
  assigned_user_id: "",
};

export default function AdminPanel({ embedded = false, onBackToSettings }: AdminPanelProps) {
  const [keys, setKeys] = useState<PoolKey[]>([]);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [users, setUsers] = useState<PoolUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState("groq");
  const [keyValue, setKeyValue] = useState("");
  const [label, setLabel] = useState("");
  const [allowSharing, setAllowSharing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingKey, setEditingKey] = useState<PoolKey | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [rotatingKey, setRotatingKey] = useState<PoolKey | null>(null);
  const [newRotatedKey, setNewRotatedKey] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [adjustingUser, setAdjustingUser] = useState<PoolUser | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState<number>(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, statusRes, usersRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/admin/pool/keys"), { credentials: "include" }),
        fetch(getApiUrl("/api/v1/admin/pool/status"), { credentials: "include" }),
        fetch(getApiUrl("/api/v1/admin/pool/users"), { credentials: "include" }),
      ]);
      if (keysRes.ok) setKeys(await keysRes.json());
      if (statusRes.ok) setPoolStatus(await statusRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (!keysRes.ok || !statusRes.ok || !usersRes.ok) {
        notify.error("Error", "Failed to load the API key pool");
      }
    } catch {
      notify.error("Error", "Failed to load API key pool data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdjustCredits = async () => {
    if (!adjustingUser) return;
    setBusyAction("credits");
    try {
      const res = await fetch(getApiUrl(`/api/v1/admin/pool/users/${adjustingUser.id}/credits`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: creditAdjustment,
          description: `Admin manual adjustment (${creditAdjustment >= 0 ? "+" : ""}${creditAdjustment})`,
        }),
      });
      if (!res.ok) {
        notify.error("Failed to update credits", await getApiErrorMessage(res, "Could not adjust credits"));
        return;
      }
      notify.success("Credits updated", `User credits updated successfully.`);
      setAdjustingUser(null);
      fetchData();
    } catch {
      notify.error("Error", "Failed to update credits");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyValue.trim()) {
      notify.error("Validation error", "API key value is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/v1/admin/pool/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          key_value: keyValue.trim(),
          label: label.trim() || undefined,
          status: "active",
          allow_sharing: allowSharing,
        }),
      });
      if (!res.ok) {
        notify.error(
          "Failed to add key",
          await getApiErrorMessage(res, "Could not save the key")
        );
        return;
      }
      notify.success("Key added", "Available accounts were assigned automatically.");
      setKeyValue("");
      setLabel("");
      setAllowSharing(false);
      fetchData();
    } catch {
      notify.error("Network error", "Failed to connect to the backend");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (key: PoolKey) => {
    setEditingKey(key);
    setEditForm({
      provider: key.provider,
      label: key.label,
      status: key.status,
      allow_sharing: key.allow_sharing,
      assigned_user_id: key.assigned_user_id || "",
    });
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    setBusyAction("edit");
    try {
      const res = await fetch(getApiUrl(`/api/v1/admin/pool/keys/${editingKey.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        notify.error(
          "Could not update key",
          await getApiErrorMessage(res, "Failed to update the key")
        );
        return;
      }
      notify.success("Key updated", "The pool changes are active immediately.");
      setEditingKey(null);
      fetchData();
    } catch {
      notify.error("Error", "Failed to update key");
    } finally {
      setBusyAction(null);
    }
  };

  const toggleStatus = async (key: PoolKey) => {
    setBusyAction(key.id);
    try {
      const nextStatus = key.status === "active" ? "inactive" : "active";
      const res = await fetch(getApiUrl(`/api/v1/admin/pool/keys/${key.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        notify.error("Error", await getApiErrorMessage(res, "Failed to update status"));
        return;
      }
      notify.success("Status updated", `Key marked as ${nextStatus}`);
      fetchData();
    } catch {
      notify.error("Error", "Failed to update key status");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteKey = async (key: PoolKey) => {
    if (!confirm(`Delete "${key.label}" from the pool? Accounts using it will be flagged.`)) {
      return;
    }
    setBusyAction(key.id);
    try {
      const res = await fetch(getApiUrl(`/api/v1/admin/pool/keys/${key.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        notify.error("Error", await getApiErrorMessage(res, "Failed to delete key"));
        return;
      }
      notify.success("Deleted", "Key removed from the pool");
      fetchData();
    } catch {
      notify.error("Error", "Failed to delete key");
    } finally {
      setBusyAction(null);
    }
  };

  const rotateKey = async () => {
    if (!rotatingKey || !newRotatedKey.trim()) return;
    setBusyAction("rotate");
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/admin/pool/keys/${rotatingKey.id}/rotate`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ key_value: newRotatedKey.trim() }),
        }
      );
      if (!res.ok) {
        notify.error("Error", await getApiErrorMessage(res, "Failed to rotate key"));
        return;
      }
      notify.success("Rotated", "The key value was replaced everywhere it is used.");
      setRotatingKey(null);
      setNewRotatedKey("");
      fetchData();
    } catch {
      notify.error("Error", "Failed to rotate key");
    } finally {
      setBusyAction(null);
    }
  };

  const assignToUser = async (userId: string) => {
    setBusyAction(userId);
    try {
      const res = await fetch(getApiUrl("/api/v1/admin/pool/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        notify.error(
          "Could not assign a key",
          await getApiErrorMessage(res, "Add an available key for the active provider first.")
        );
        return;
      }
      notify.success("Key assigned", "The account can now generate presentations.");
      fetchData();
    } catch {
      notify.error("Error", "Failed to assign key");
    } finally {
      setBusyAction(null);
    }
  };

  const syncAssignments = async () => {
    setBusyAction("sync");
    try {
      const res = await fetch(getApiUrl("/api/v1/admin/pool/sync"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        notify.error("Error", await getApiErrorMessage(res, "Failed to sync assignments"));
        return;
      }
      const result = await res.json();
      notify.success(
        "Assignments synced",
        `${result.assigned_count ?? 0} account${(result.assigned_count ?? 0) === 1 ? "" : "s"} assigned across ${result.total_keys ?? 0} key${(result.total_keys ?? 0) === 1 ? "" : "s"}.`
      );
      fetchData();
    } catch {
      notify.error("Error", "Failed to sync assignments");
    } finally {
      setBusyAction(null);
    }
  };

  const rebalanceAssignments = async () => {
    setBusyAction("balance");
    try {
      const res = await fetch(getApiUrl("/api/v1/admin/pool/balance"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        notify.error("Error", await getApiErrorMessage(res, "Failed to rebalance keys"));
        return;
      }
      const result = await res.json();
      const spread =
        Array.isArray(result.distribution) && result.distribution.length > 0
          ? result.distribution
              .map((item: { users: number }) => item.users)
              .join(" / ")
          : "no keys";
      notify.success(
        "Keys rebalanced",
        `${result.assigned ?? 0} account${(result.assigned ?? 0) === 1 ? "" : "s"} distributed across ${result.total_keys ?? 0} key${(result.total_keys ?? 0) === 1 ? "" : "s"} (${spread}).`
      );
      fetchData();
    } catch {
      notify.error("Error", "Failed to rebalance keys");
    } finally {
      setBusyAction(null);
    }
  };

  const missingUsers = poolStatus?.users_missing_keys || [];

  return (
    <div className={embedded ? "space-y-6 pb-24" : "mx-auto max-w-6xl space-y-6 p-8 pb-24 font-syne"}>
      {onBackToSettings && (
        <button
          type="button"
          onClick={onBackToSettings}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#667085] hover:text-[#101323]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to provider settings
        </button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#101323]">API Key Management</h1>
          <p className="mt-1 text-sm text-[#667085]">
            The central pool for all AI provider keys. Keys are assigned to
            accounts automatically and are never exposed to users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={rebalanceAssignments}
            disabled={busyAction === "balance" || keys.length === 0}
            title="Distribute all accounts evenly across the active API keys"
            className="inline-flex items-center gap-2 rounded-lg bg-[#3478F6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${busyAction === "balance" ? "animate-spin" : ""}`} />
            {busyAction === "balance" ? "Rebalancing..." : "Rebalance keys"}
          </button>
          <button
            type="button"
            onClick={syncAssignments}
            disabled={busyAction === "sync"}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busyAction === "sync" ? "animate-spin" : ""}`} />
            Sync assignments
          </button>
        </div>
      </div>

      {poolStatus && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E1E1E5] bg-white p-4">
            <p className="text-xs text-[#667085]">Active provider</p>
            <p className="mt-1 text-sm font-semibold capitalize text-[#101323]">
              {poolStatus.active_provider}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#667085]">{poolStatus.active_model}</p>
          </div>
          <div className="rounded-xl border border-[#E1E1E5] bg-white p-4">
            <p className="text-xs text-[#667085]">Active keys</p>
            <p className="mt-1 text-sm font-semibold text-[#101323]">
              {poolStatus.total_active_keys}
            </p>
            <p className="mt-0.5 text-xs text-[#667085]">
              {poolStatus.available_unassigned_keys} unassigned
            </p>
          </div>
          <div className="rounded-xl border border-[#E1E1E5] bg-white p-4">
            <p className="text-xs text-[#667085]">Accounts missing a key</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                missingUsers.length ? "text-amber-600" : "text-green-700"
              }`}
            >
              {missingUsers.length}
            </p>
            <p className="mt-0.5 text-xs text-[#667085]">
              {poolStatus.has_keys ? "Pool available" : "Pool empty"}
            </p>
          </div>
        </div>
      )}

      {poolStatus?.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1 font-medium">{poolStatus.error}</div>
        </div>
      )}

      {missingUsers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <UserCheck className="h-4 w-4" />
            {missingUsers.length} account{missingUsers.length === 1 ? "" : "s"} without an API key
          </div>
          <p className="mt-1 text-xs text-amber-700">
            These accounts can sign in but generation will fail until a key is assigned.
            Add a key above and they are assigned automatically, or assign one manually.
          </p>
          <ul className="mt-3 space-y-2">
            {missingUsers.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
              >
                <span className="text-xs font-medium text-[#101323]">
                  {user.username}
                  {user.is_admin ? " (admin)" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => assignToUser(user.id)}
                  disabled={busyAction === user.id || (poolStatus?.available_unassigned_keys ?? 0) === 0}
                  className="rounded-md bg-[#3478F6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === user.id ? "Assigning..." : "Assign key"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-[#E1E1E5] bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#101323]">
          <Plus className="h-4 w-4 text-[#3478F6]" /> Add API Key to Pool
        </h2>
        <form onSubmit={handleCreateKey} className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#344054]">Provider</label>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101323] outline-none focus:border-[#3478F6]"
            >
              {PROVIDERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#344054]">Key Label</label>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Primary Groq Key"
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101323] outline-none focus:border-[#3478F6]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#344054]">API Key Secret</label>
            <div className="flex gap-2">
              <input
                type="password"
                required
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder="gsk_... or sk-..."
                className="flex-1 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101323] outline-none focus:border-[#3478F6]"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3478F6] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {isSubmitting ? "Adding..." : "Add Key"}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#475467] md:col-span-4">
            <input
              type="checkbox"
              checked={allowSharing}
              onChange={(event) => setAllowSharing(event.target.checked)}
              className="h-4 w-4 rounded border-[#D0D5DD]"
            />
            Allow this key to be shared when no unassigned key is available
          </label>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E1E1E5] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E1E1E5] bg-[#F9FAFB] p-4">
          <span className="text-sm font-semibold text-[#101323]">
            Managed API Keys ({keys.length})
          </span>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3478F6] hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#667085]">Loading keys...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#667085]">
            No API keys in the pool. Add one above to enable generation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#EAECF0] bg-[#F9FAFB] text-xs font-medium text-[#667085]">
                <tr>
                  <th className="px-6 py-3">Label & Key</th>
                  <th className="px-6 py-3">Provider</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Assigned Accounts</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0]">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-[#F9FAFB]/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#101323]">{key.label}</div>
                      <div className="mt-0.5 font-mono text-xs text-[#667085]">
                        {key.masked_key}
                      </div>
                      {key.allow_sharing && (
                        <div className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          Sharing allowed
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                        {key.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => toggleStatus(key)}
                        disabled={busyAction === key.id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                          key.status === "active"
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {key.status === "active" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-gray-500" />
                        )}
                        {key.status === "active" ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {(key.assigned_count ?? 0) > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-block rounded bg-[#EFF5FF] px-2 py-1 text-xs font-medium text-[#3478F6]">
                            {key.assigned_count} account
                            {(key.assigned_count ?? 0) === 1 ? "" : "s"}
                          </span>
                          {key.assigned_usernames?.length ? (
                            <p
                              className="max-w-[220px] truncate text-[11px] text-[#667085]"
                              title={key.assigned_usernames.join(", ")}
                            >
                              {key.assigned_usernames.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-[#98A2B3]">Unassigned</span>
                      )}
                    </td>
                    <td className="space-x-3 px-6 py-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(key)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#667085] hover:text-[#101323]"
                        title="Edit key"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotatingKey(key)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#3478F6] hover:text-[#3478F6]"
                        title="Rotate key"
                      >
                        <RotateCw className="h-3.5 w-3.5" /> Rotate
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteKey(key)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                        title="Delete key"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Accounts & Credit Balances */}
      <div className="rounded-xl border border-[#E1E1E5] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#EAECF0] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#101323]">User Accounts & Credits</h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              Real-time presentation credit balances, welcome allowance, and manual adjustments
            </p>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#667085]">No user accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#EAECF0] bg-[#F9FAFB] text-xs font-medium text-[#667085]">
                <tr>
                  <th className="px-6 py-3">Account</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Available Credits</th>
                  <th className="px-6 py-3">Free Welcome Deck</th>
                  <th className="px-6 py-3">Paid Plan Customer</th>
                  <th className="px-6 py-3 text-right">Credit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F9FAFB]/50">
                    <td className="px-6 py-4 font-medium text-[#101323]">
                      {u.username}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${u.is_admin ? "bg-[#EFF5FF] text-[#3478F6]" : "bg-neutral-100 text-neutral-600"}`}>
                        {u.is_admin ? "Administrator" : "User"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-bold text-[#3478F6]">
                        {u.credits ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.free_presentation_used ? (
                        <span className="text-xs text-neutral-400">Claimed</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.has_purchased_credits ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                          Yes (Unlocked)
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">No Purchases</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingUser(u);
                          setCreditAdjustment(50);
                        }}
                        className="rounded-lg border border-[#D0D5DD] px-3 py-1 text-xs font-semibold text-[#344054] hover:bg-neutral-50"
                      >
                        Adjust Credits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl font-syne">
            <h3 className="text-lg font-bold text-[#101323]">Adjust Credits for {adjustingUser.username}</h3>
            <p className="text-xs text-[#667085]">
              Current balance: <strong>{adjustingUser.credits ?? 0} credits</strong>. Positive numbers add credits, negative numbers deduct.
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#344054]">Credits change amount</label>
              <input
                type="number"
                value={creditAdjustment}
                onChange={(e) => setCreditAdjustment(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#3478F6]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setAdjustingUser(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[#667085] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction === "credits"}
                onClick={handleAdjustCredits}
                className="rounded-lg bg-[#3478F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
              >
                {busyAction === "credits" ? "Updating..." : "Confirm Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#101323]">Edit API Key</h3>
            <p className="text-xs text-[#667085]">
              The secret itself is never shown. Use Rotate to replace it.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#344054]">Label</label>
                <input
                  type="text"
                  value={editForm.label}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, label: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#3478F6]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#344054]">Provider</label>
                  <select
                    value={editForm.provider}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, provider: event.target.value }))
                    }
                    className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#3478F6]"
                  >
                    {PROVIDERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#344054]">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#3478F6]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs text-[#475467]">
                {editingKey.assigned_count ?? 0} account
                {(editingKey.assigned_count ?? 0) === 1 ? "" : "s"} currently
                assigned. Use <strong className="font-semibold">Rebalance keys</strong>{" "}
                to redistribute accounts evenly.
              </div>
              <label className="flex items-center gap-2 text-xs text-[#475467]">
                <input
                  type="checkbox"
                  checked={editForm.allow_sharing}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      allow_sharing: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-[#D0D5DD]"
                />
                Allow sharing as a fallback key
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[#667085] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busyAction === "edit"}
                className="rounded-lg bg-[#3478F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
              >
                {busyAction === "edit" ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rotatingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#101323]">Rotate API Key</h3>
            <p className="text-xs text-[#667085]">
              Replacing the secret for <strong>{rotatingKey.label}</strong> (
              {rotatingKey.provider}). Accounts using it keep their assignment.
            </p>
            <input
              type="password"
              placeholder="Enter new API key"
              value={newRotatedKey}
              onChange={(event) => setNewRotatedKey(event.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#3478F6]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRotatingKey(null);
                  setNewRotatedKey("");
                }}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[#667085] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={rotateKey}
                disabled={busyAction === "rotate" || !newRotatedKey.trim()}
                className="rounded-lg bg-[#3478F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
              >
                {busyAction === "rotate" ? "Rotating..." : "Confirm Rotate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
