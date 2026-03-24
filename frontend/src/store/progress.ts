import { create } from "zustand";
import { progressApi, labsApi } from "@/lib/api";

export type ModuleStatus = "locked" | "available" | "in_progress" | "completed";
export type ChallengeStatus = "not_started" | "in_progress" | "passed" | "failed";

export interface ModuleProgress {
  user_id: number;
  module_id: number;
  status: ModuleStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface ChallengeAttempt {
  id: number;
  module_id: number;
  challenge_id: number;
  status: ChallengeStatus;
  attempt_count: number;
  validation_output: Record<string, unknown> | null;
  passed_at: string | null;
}

export interface LabSession {
  id: number;
  module_id: number;
  container_id: string | null;
  container_name: string | null;
  container_port: number | null;
  container_host: string | null;
  status: string;
  created_at: string;
}

interface ProgressState {
  modules: ModuleProgress[];
  challenges: Record<number, ChallengeAttempt[]>;
  activeSessions: Record<number, LabSession>;
  dashboardData: Record<string, unknown> | null;
  isLoading: boolean;

  fetchDashboard: () => Promise<void>;
  fetchModules: () => Promise<void>;
  fetchChallenges: (moduleId: number) => Promise<void>;
  startLab: (moduleId: number) => Promise<LabSession>;
  stopLab: (moduleId: number) => Promise<void>;
  validateChallenge: (
    moduleId: number,
    challengeId: number,
    payload?: Record<string, unknown>
  ) => Promise<{ passed: boolean; message: string; details: Record<string, unknown> }>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  modules: [],
  challenges: {},
  activeSessions: {},
  dashboardData: null,
  isLoading: false,

  fetchDashboard: async () => {
    const res = await progressApi.dashboard();
    set({ dashboardData: res.data });
  },

  fetchModules: async () => {
    set({ isLoading: true });
    const res = await progressApi.modules();
    set({ modules: res.data, isLoading: false });
  },

  fetchChallenges: async (moduleId) => {
    const res = await progressApi.challenges(moduleId);
    set((s) => ({ challenges: { ...s.challenges, [moduleId]: res.data } }));
  },

  startLab: async (moduleId) => {
    const res = await labsApi.start(moduleId);
    const session: LabSession = res.data;
    set((s) => ({ activeSessions: { ...s.activeSessions, [moduleId]: session } }));
    return session;
  },

  stopLab: async (moduleId) => {
    await labsApi.stop(moduleId);
    set((s) => {
      const sessions = { ...s.activeSessions };
      delete sessions[moduleId];
      return { activeSessions: sessions };
    });
  },

  validateChallenge: async (moduleId, challengeId, payload) => {
    const res = await labsApi.validate(moduleId, challengeId, payload);
    // Re-fetch modules to get updated lock state
    await get().fetchModules();
    await get().fetchChallenges(moduleId);
    return res.data;
  },
}));
