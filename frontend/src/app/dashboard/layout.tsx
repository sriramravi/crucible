"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useProgressStore } from "@/store/progress";
import Sidebar from "@/components/ui/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { fetchModules } = useProgressStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    fetchModules();
  }, [user, router, fetchModules]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
