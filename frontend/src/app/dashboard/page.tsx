"use client";
import { useEffect } from "react";
import { useProgressStore, ModuleStatus } from "@/store/progress";
import { useAuthStore } from "@/store/auth";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import clsx from "clsx";
import {
  GitBranch, Zap, Package, Cloud, Server, AlertTriangle,
  Search, Radar, Lock, FileCheck, CheckCircle2, Circle,
  Clock, TrendingUp
} from "lucide-react";

const MODULE_META = [
  { id: 1, name: "Version Control", icon: GitBranch, tool: "Gitea", challenges: 2 },
  { id: 2, name: "CI/CD", icon: Zap, tool: "Gitea Actions + Jenkins", challenges: 3 },
  { id: 3, name: "Artifact Management", icon: Package, tool: "Gitea Packages + Nexus", challenges: 2 },
  { id: 4, name: "Infrastructure as Code", icon: Cloud, tool: "OpenTofu + LocalStack", challenges: 3 },
  { id: 5, name: "Cloud (Theory)", icon: Server, tool: "Quiz + Diagram", challenges: 2 },
  { id: 6, name: "Threat Modelling", icon: AlertTriangle, tool: "OWASP Threat Dragon", challenges: 2 },
  { id: 7, name: "SAST", icon: Search, tool: "Semgrep + Bandit", challenges: 4 },
  { id: 8, name: "DAST", icon: Radar, tool: "OWASP ZAP + Juice Shop", challenges: 3 },
  { id: 9, name: "Security as Code", icon: Lock, tool: "OPA + Conftest + Checkov", challenges: 3 },
  { id: 10, name: "Compliance as Code", icon: FileCheck, tool: "Chef InSpec", challenges: 3 },
];

const STATUS_CONFIG: Record<ModuleStatus, { label: string; color: string; bg: string }> = {
  locked: { label: "Locked", color: "text-slate-500", bg: "bg-slate-800" },
  available: { label: "Available", color: "text-blue-400", bg: "bg-blue-900/30" },
  in_progress: { label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-900/30" },
  completed: { label: "Completed", color: "text-green-400", bg: "bg-green-900/30" },
};

export default function DashboardPage() {
  const { modules, dashboardData, fetchDashboard, fetchModules } = useProgressStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchDashboard();
    fetchModules();
  }, [fetchDashboard, fetchModules]);

  const completed = (dashboardData as { completed_modules?: number })?.completed_modules ?? 0;
  const inProgress = (dashboardData as { in_progress_modules?: number })?.in_progress_modules ?? 0;
  const pct = Math.round((completed / 10) * 100);

  const chartData = [{ name: "Progress", value: pct, fill: "#0ea5e9" }];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, <span className="text-brand-400">{user?.username}</span>
        </h1>
        <p className="text-slate-400 mt-1">Track your Crucible progress</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Completed"
          value={completed}
          suffix="/ 10"
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
          color="text-green-400"
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          icon={<Clock className="w-5 h-5 text-yellow-400" />}
          color="text-yellow-400"
        />
        <StatCard
          label="Completion"
          value={pct}
          suffix="%"
          icon={<TrendingUp className="w-5 h-5 text-brand-400" />}
          color="text-brand-400"
        />
        <StatCard
          label="Remaining"
          value={10 - completed}
          icon={<Circle className="w-5 h-5 text-slate-400" />}
          color="text-slate-400"
        />
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MODULE_META.map((meta) => {
          const progress = modules.find((m) => m.module_id === meta.id);
          const status: ModuleStatus = progress?.status || "locked";
          const cfg = STATUS_CONFIG[status];
          const Icon = meta.icon;
          const isLocked = status === "locked";

          return (
            <div
              key={meta.id}
              className={clsx(
                "card transition-all duration-200",
                isLocked ? "opacity-50 cursor-not-allowed" : "hover:border-brand-700 hover:shadow-lg cursor-pointer"
              )}
            >
              <Link
                href={isLocked ? "#" : `/modules/${meta.id}`}
                onClick={(e) => isLocked && e.preventDefault()}
                className="block"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", cfg.bg)}>
                    <Icon className={clsx("w-5 h-5", cfg.color)} />
                  </div>
                  <span className={clsx("badge", cfg.bg, cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-1">Module {meta.id}</div>
                <h3 className="text-base font-semibold text-white mb-1">{meta.name}</h3>
                <p className="text-xs text-slate-400 mb-3">{meta.tool}</p>

                {/* Challenge progress dots */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: meta.challenges }).map((_, i) => (
                    <div
                      key={i}
                      className={clsx(
                        "w-2 h-2 rounded-full",
                        status === "completed" ? "bg-green-400" : "bg-surface-700"
                      )}
                    />
                  ))}
                  <span className="text-xs text-slate-500 ml-1">{meta.challenges} challenge{meta.challenges > 1 ? "s" : ""}</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label, value, suffix = "", icon, color,
}: {
  label: string; value: number; suffix?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className="bg-surface-800 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className={clsx("text-2xl font-bold", color)}>
          {value}<span className="text-base font-normal text-slate-400">{suffix}</span>
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}
