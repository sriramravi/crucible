import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// Attach auth token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to /auth/login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post("/auth/register", data),
  login: (data: { username: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// ─── Progress ─────────────────────────────────────────────────────────────────

export const progressApi = {
  dashboard: () => api.get("/progress/dashboard"),
  modules: () => api.get("/progress/modules"),
  module: (id: number) => api.get(`/progress/modules/${id}`),
  challenges: (moduleId: number) => api.get(`/progress/modules/${moduleId}/challenges`),
};

// ─── Labs ─────────────────────────────────────────────────────────────────────

export const labsApi = {
  start: (moduleId: number) => api.post(`/labs/modules/${moduleId}/start`),
  stop: (moduleId: number) => api.post(`/labs/modules/${moduleId}/stop`),
  validate: (moduleId: number, challengeId: number, payload?: Record<string, unknown>) =>
    api.post("/labs/validate", { module_id: moduleId, challenge_id: challengeId, payload }),
  quizQuestions: () => api.get("/labs/quiz/questions"),
  submitQuiz: (answers: Record<number, string>) =>
    api.post("/labs/quiz", { module_id: 5, answers }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
  users: (skip = 0, limit = 100) => api.get(`/admin/users?skip=${skip}&limit=${limit}`),
  user: (id: number) => api.get(`/admin/users/${id}`),
  updateUser: (id: number, data: Record<string, unknown>) => api.patch(`/admin/users/${id}`, data),
  createUser: (data: Record<string, unknown>, role = "learner") =>
    api.post(`/admin/users?role=${role}`, data),
  stats: () => api.get("/admin/stats"),
  userProgress: (id: number) => api.get(`/admin/users/${id}/progress`),
  resetModule: (userId: number, moduleId: number) =>
    api.post(`/admin/users/${userId}/reset-module/${moduleId}`),
};
