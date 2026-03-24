"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function RootPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace(user.role === "admin" ? "/admin" : "/dashboard");
    } else {
      router.replace("/auth/login");
    }
  }, [user, router]);

  return null;
}
