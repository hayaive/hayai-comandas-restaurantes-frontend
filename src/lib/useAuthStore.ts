import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api";
import * as authApi from "@/api/auth";
import type { Usuario } from "@/api/auth";

interface AuthState {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  status: "idle" | "loading" | "error";
  error: string | null;
  /**
   * `false` sólo en un caso: una sesión guardada ANTES de este cambio, cuyo
   * `usuario` en `localStorage` no trae `modulos`. Mientras esté en `false`,
   * `usePuedeVer` (`src/lib/permisos.ts`) NO filtra — trata al usuario como
   * "se ve todo" en vez de "no se ve nada", porque interpretar la ausencia
   * del campo como "sin módulos" dejaría a TODO el personal con la pantalla
   * en blanco justo el día del deploy. `useModulosBootstrap` la pone en
   * `true` en cuanto `GET /auth/yo` (o el login/canje más reciente) trae el
   * dato real.
   */
  modulosListos: boolean;

  login: (usuario: string, clave: string) => Promise<void>;
  loginPin: (usuario: string, pin: string) => Promise<void>;
  /** Canje de acceso temporal (`POST /auth/acceso`) — misma forma de respuesta que `login`. */
  canjearAcceso: (restaurante: string, token: string, codigo: string) => Promise<void>;
  /** `GET /auth/yo`. No lanza: un refresco de fondo que falla no debe romper nada, sólo no adelanta el dato. */
  refrescarModulos: () => Promise<void>;
  logout: () => void;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

/** `true` si el usuario guardado ya trae `modulos` (sesión nueva) o si no hay sesión (no aplica el filtro a nadie). */
function modulosYaCargados(usuario: Usuario | null): boolean {
  return usuario === null || Array.isArray(usuario.modulos);
}

export const useAuthStore = create<AuthState>((set, get) => {
  // The session can also be cleared from outside any store action — e.g.
  // httpClient.ts reacting to a 401 on some unrelated screen's request. Stay
  // in sync with it so the router guard picks up the change immediately.
  authApi.subscribeSession(() => {
    const usuario = authApi.getStoredUsuario();
    set({
      usuario,
      isAuthenticated: authApi.hasSession(),
      modulosListos: modulosYaCargados(usuario),
    });
  });

  const usuarioInicial = authApi.getStoredUsuario();

  return {
    usuario: usuarioInicial,
    isAuthenticated: authApi.hasSession(),
    status: "idle",
    error: null,
    modulosListos: modulosYaCargados(usuarioInicial),

    async login(usuario: string, clave: string) {
      set({ status: "loading", error: null });
      try {
        const result = await authApi.login(usuario, clave);
        // La respuesta de login ya trae `modulos` efectivos: no hace falta
        // esperar ningún refresco aparte.
        set({ status: "idle", usuario: result.usuario, isAuthenticated: true, modulosListos: true });
      } catch (error) {
        set({ status: "error", error: messageOf(error) });
        throw error;
      }
    },

    async loginPin(usuario: string, pin: string) {
      set({ status: "loading", error: null });
      try {
        const result = await authApi.loginPin(usuario, pin);
        set({ status: "idle", usuario: result.usuario, isAuthenticated: true, modulosListos: true });
      } catch (error) {
        set({ status: "error", error: messageOf(error) });
        throw error;
      }
    },

    async canjearAcceso(restaurante: string, token: string, codigo: string) {
      set({ status: "loading", error: null });
      try {
        const result = await api.canjearAcceso({ restaurante, token, codigo });
        authApi.adoptarSesion(result.token, result.usuario);
        set({ status: "idle", usuario: result.usuario, isAuthenticated: true, modulosListos: true });
      } catch (error) {
        set({ status: "error", error: messageOf(error) });
        throw error;
      }
    },

    async refrescarModulos() {
      const usuario = await authApi.obtenerYo();
      // Se marca "listo" pase lo que pase: si no se pudo refrescar (sin red),
      // seguir esperando indefinidamente dejaría el filtro en modo "muestra
      // todo" para siempre, que es el mismo riesgo que se quería evitar del
      // otro lado. El usuario ya guardado sigue siendo el mejor dato posible.
      set({ usuario: usuario ?? get().usuario, modulosListos: true });
    },

    logout() {
      authApi.logout();
      set({ usuario: null, isAuthenticated: false, status: "idle", error: null, modulosListos: true });
    },
  };
});

/**
 * Se monta una vez en `AppShell`, igual que `useRestauranteBootstrap` /
 * `useTasaBootstrap`. Dispara `GET /auth/yo` sólo cuando hace falta —una
 * sesión ya "lista" (login/canje reciente, o `modulos` ya presente en
 * `localStorage`) no repite la llamada en cada montaje.
 */
export function useModulosBootstrap(): void {
  const modulosListos = useAuthStore((state) => state.modulosListos);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refrescarModulos = useAuthStore((state) => state.refrescarModulos);

  useEffect(() => {
    if (isAuthenticated && !modulosListos) void refrescarModulos();
  }, [isAuthenticated, modulosListos, refrescarModulos]);
}
