"use client";
import { use, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Loader2, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const MODULE_NAMES = [
  "Version Control", "CI/CD", "Artifact Mgmt", "IaC",
  "Cloud Theory", "Threat Modelling", "SAST", "DAST",
  "Security as Code", "Compliance as Code",
];

const STATUS_COLORS: Record<string, string> = {
  locked: "text-slate-500",
  available: "text-blue-400",
  in_progress: "text-yellow-400",
  completed: "text-green-400",
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = parseInt(id, 10);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.userProgress(userId);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const resetModule = async (moduleId: number) => {
    setResetting(moduleId);
    await adminApi.resetModule(userId, moduleId);
    await fetchData();
    setResetting(null);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 text-brand-400 animate-spin" /></div>;
  if (!data) return <div className="p-8 text-red-400">User not found</div>;

  const progress = (data.module_progress as Array<{ module_id: number; status: string }>) || [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/admin" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Admin
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{data.username as string}</h1>
        <p className="text-slate-400 mt-1">
          {data.completed_modules as number} / 10 modules completed &middot;{" "}
          {data.overall_percentage as number}% overall
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-white mb-4">Module Progress</h2>
        <div className="space-y-2">
          {progress.map((p) => (
            <div key={p.module_id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-surface-800 flex items-center justify-center text-xs text-slate-500 font-mono">
                  {p.module_id}
                </div>
                <span className="text-sm text-slate-300">{MODULE_NAMES[p.module_id - 1]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx("text-xs font-medium capitalize", STATUS_COLORS[p.status])}>
                  {p.status.replace("_", " ")}
                </span>
                <button
                  onClick={() => resetModule(p.module_id)}
                  disabled={resetting === p.module_id || p.status === "locked"}
                  className="text-slate-600 hover:text-yellow-400 disabled:opacity-30 transition-colors"
                  title="Reset module progress"
                >
                  {resetting === p.module_id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <RotateCcw className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
