"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useProgressStore } from "@/store/progress";
import clsx from "clsx";
import {
  Shield, LayoutDashboard, BookOpen, Settings, LogOut,
  GitBranch, Zap, Package, Cloud, Server, AlertTriangle,
  Search, Radar, Lock, FileCheck, ChevronRight
} from "lucide-react";

const MODULE_ICONS = [
  GitBranch, Zap, Package, Cloud, Server,
  AlertTriangle, Search, Radar, Lock, FileCheck,
];

const MODULE_NAMES = [
  "Version Control", "CI/CD", "Artifact Mgmt", "IaC",
  "Cloud (Theory)", "Threat Modelling", "SAST", "DAST",
  "Security as Code", "Compliance as Code",
];

const STATUS_DOT: Record<string, string> = {
  locked: "bg-slate-600",
  available: "bg-blue-400",
  in_progress: "bg-yellow-400",
  completed: "bg-green-400",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { modules } = useProgressStore();

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-900 border-r border-surface-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Crucible</div>
            <div className="text-xs text-slate-500">DevSecOps Platform</div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} />

        <div className="pt-3 pb-1 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Modules
        </div>

        {MODULE_NAMES.map((name, i) => {
          const moduleId = i + 1;
          const progress = modules.find((m) => m.module_id === moduleId);
          const status = progress?.status || "locked";
          const Icon = MODULE_ICONS[i];
          const isActive = pathname.startsWith(`/modules/${moduleId}`);
          const isLocked = status === "locked";

          return (
            <Link
              key={moduleId}
              href={isLocked ? "#" : `/modules/${moduleId}`}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group",
                isLocked
                  ? "text-slate-600 cursor-not-allowed"
                  : isActive
                  ? "bg-brand-900/50 text-brand-300 border border-brand-800"
                  : "text-slate-400 hover:bg-surface-800 hover:text-slate-200"
              )}
              onClick={(e) => isLocked && e.preventDefault()}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{moduleId}. {name}</span>
              <div className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[status])} />
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <>
            <div className="pt-3 pb-1 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Admin
            </div>
            <NavItem href="/admin" icon={Settings} label="Admin Panel" active={pathname.startsWith("/admin")} />
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white uppercase">
            {user?.username?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.username}</div>
            <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href, icon: Icon, label, active,
}: {
  href: string; icon: React.ElementType; label: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-brand-900/50 text-brand-300 border border-brand-800"
          : "text-slate-400 hover:bg-surface-800 hover:text-slate-200"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </Link>
  );
}
