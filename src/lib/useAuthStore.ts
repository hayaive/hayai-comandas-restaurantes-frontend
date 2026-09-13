import { create } from "zustand";
import { ApiError } from "@/api";
import * as authApi from "@/api/auth";
import type { Usuario } from "@/api/auth";

interface AuthState {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  status: "idle" | "loading" | "error";
  error: string | null;

  login: (usuario: string, clave: string) => Promise<void>;
  loginPin: (usuario: string, pin: string) => Promise<void>;
  logout: () => void;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export const useAuthStore = create<AuthState>((set) => {
  // The session can also be cleared from outside any store action — e.g.
  // httpClient.ts reacting to a 401 on some unrelated screen's request. Stay
  // in sync with it so the router guard picks up the change immediately.
  authApi.subscribeSession(() => {
    set({ usuario: authApi.getStoredUsuario(), isAuthenticated: authApi.hasSession() });
  });

  return {
    usuario: authApi.getStoredUsuario(),
    isAuthenticated: authApi.hasSession(),
    status: "idle",
    error: null,

    async login(usuario: string, clave: string) {
      set({ status: "loading", error: null });
      try {
        const result = await authApi.login(usuario, clave);
        set({ status: "idle", usuario: result.usuario, isAuthenticated: true });
      } catch (error) {
        set({ status: "error", error: messageOf(error) });
        throw error;
      }
    },

    async loginPin(usuario: string, pin: string) {
      set({ status: "loading", error: null });
      try {
        const result = await authApi.loginPin(usuario, pin);
        set({ status: "idle", usuario: result.usuario, isAuthenticated: true });
      } catch (error) {
        set({ status: "error", error: messageOf(error) });
        throw error;
      }
    },

    logout() {
      authApi.logout();
      set({ usuario: null, isAuthenticated: false, status: "idle", error: null });
    },
  };
});
