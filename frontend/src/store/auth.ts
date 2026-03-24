import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "learner";
  is_active: boolean;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const res = await authApi.login({ username, password });
          const { access_token, user } = res.data;
          localStorage.setItem("access_token", access_token);
          set({ token: access_token, user, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true });
        try {
          const res = await authApi.register({ username, email, password });
          const { access_token, user } = res.data;
          localStorage.setItem("access_token", access_token);
          set({ token: access_token, user, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({ user: null, token: null });
      },

      fetchMe: async () => {
        try {
          const res = await authApi.me();
          set({ user: res.data });
        } catch {
          get().logout();
        }
      },
    }),
    { name: "crucible-auth", partialize: (s) => ({ token: s.token, user: s.user }) }
  )
);
