"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import clsx from "clsx";
import { Users, Activity, Server, BarChart3, RefreshCw, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_module_completions: number;
  total_challenge_attempts: number;
  active_lab_sessions: number;
  module_stats: Array<{ module_id: number; completed_count: number }>;
}

const MODULE_NAMES = [
  "Version Control", "CI/CD", "Artifact Mgmt", "IaC",
  "Cloud Theory", "Threat Modelling", "SAST", "DAST",
  "Security as Code", "Compliance as Code",
];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([adminApi.users(), adminApi.stats()]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleUser = async (id: number, active: boolean) => {
    setToggling(id);
    await adminApi.updateUser(id, { is_active: !active });
    await fetchData();
    setToggling(null);
  };

  const resetModule = async (userId: number, moduleId: number) => {
    const key = `${userId}-${moduleId}`;
    setResetting(key);
    await adminApi.resetModule(userId, moduleId);
    setResetting(null);
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-slate-400 mt-1">Manage users and monitor platform activity</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Users" value={stats.total_users} icon={<Users className="w-5 h-5 text-brand-400" />} />
          <StatCard label="Module Completions" value={stats.total_module_completions} icon={<BarChart3 className="w-5 h-5 text-green-400" />} />
          <StatCard label="Challenge Attempts" value={stats.total_challenge_attempts} icon={<Activity className="w-5 h-5 text-yellow-400" />} />
          <StatCard label="Active Sessions" value={stats.active_lab_sessions} icon={<Server className="w-5 h-5 text-red-400" />} />
        </div>
      )}

      {/* Module completion heatmap */}
      {stats && (
        <div className="card mb-8">
          <h2 className="font-semibold text-white mb-4">Module Completion Overview</h2>
          <div className="grid grid-cols-5 gap-3">
            {stats.module_stats.map((m) => {
              const pct = stats.total_users > 0 ? Math.round((m.completed_count / stats.total_users) * 100) : 0;
              return (
                <div key={m.module_id} className="bg-surface-800 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">M{m.module_id}</div>
                  <div className="text-sm text-white font-medium truncate">{MODULE_NAMES[m.module_id - 1]}</div>
                  <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{m.completed_count} / {stats.total_users}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Users ({users.length})</h2>
          <Link href="/admin/users/new" className="btn-primary text-sm">
            + Add User
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-surface-800">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {users.map((u) => (
                <tr key={u.id} className="text-slate-300">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-800 flex items-center justify-center text-xs font-bold text-brand-300 uppercase">
                        {u.username[0]}
                      </div>
                      <span className="font-medium text-white">{u.username}</span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-400">{u.email}</td>
                  <td className="py-3">
                    <span className={clsx("badge", u.role === "admin" ? "bg-purple-900 text-purple-300" : "bg-surface-800 text-slate-400")}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={clsx("badge", u.is_active ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300")}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleUser(u.id, u.is_active)}
                        disabled={toggling === u.id}
                        className={clsx("text-xs px-2 py-1 rounded border transition-colors",
                          u.is_active
                            ? "border-red-800 text-red-400 hover:bg-red-900/20"
                            : "border-green-800 text-green-400 hover:bg-green-900/20"
                        )}
                      >
                        {toggling === u.id ? "..." : u.is_active ? "Disable" : "Enable"}
                      </button>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="bg-surface-800 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}
