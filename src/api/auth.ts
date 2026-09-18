import { ApiError, TODOS_LOS_MODULOS } from "./types";
import type { Usuario } from "./types";

/** Reexportado por compatibilidad: el resto de la app sigue haciendo
 * `import type { Usuario } from "@/api/auth"`. La definición vive en
 * `types.ts` porque `ApiClient.canjearAcceso` también la necesita — ver el
 * comentario en ese archivo. */
export type { Usuario };

/**
 * Session storage + login/logout, separate from `ApiClient` (`httpClient.ts` /
 * `mockClient.ts`) because auth is not part of that request/response contract
 * — it is what makes every other call on `ApiClient` possible.
 *
 * `httpClient.ts`'s `request()` reads `getToken()` to attach the
 * `Authorization` header and calls `handleUnauthorized()` on a 401 so a stale
 * or expired token clears itself instead of leaving screens stuck. Following
 * `src/api/index.ts`'s own pattern, this module switches to a trivial
 * always-succeeds mock whenever `VITE_API_URL` is unset, so local development
 * without the backend never requires a real login.
 */

const TOKEN_KEY = "hayai.auth.token";
const USUARIO_KEY = "hayai.auth.usuario";
/** Bandera de sesión-a-sesión (no persiste al cerrar la pestaña) para que
 * `LoginPage` sepa mostrar "tu acceso terminó" en vez del formulario normal
 * tras un 401 de un acceso temporal. Ver `handleUnauthorized` /
 * `tomarAvisoAccesoVencido`. */
const ACCESO_VENCIDO_KEY = "hayai.auth.accesoVencido";

export interface LoginResult {
  token: string;
  usuario: Usuario;
}

function apiBaseUrl(): string | undefined {
  return import.meta.env.VITE_API_URL as string | undefined;
}

/** Mirrors `isUsingMockApi` in `./index`, kept local to avoid a circular import. */
export const isUsingMockAuth = !apiBaseUrl();

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUsuario(): Usuario | null {
  try {
    const raw = localStorage.getItem(USUARIO_KEY);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Lets the auth store react to a session change triggered outside of it — e.g. httpClient clearing a stale token on 401. */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persistSession(token: string, usuario: Usuario): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  } catch {
    // localStorage unavailable (private mode, storage full, etc.) — the
    // session simply won't survive a reload; the in-memory store still works.
  }
  notify();
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
  } catch {
    // ignore
  }
  notify();
}

/** In mock mode there is no real session to check — the app is always "in". */
export function hasSession(): boolean {
  return isUsingMockAuth ? true : getToken() !== null;
}

/**
 * Called by `httpClient.ts` when the real backend answers 401 on a protected
 * call.
 *
 * Un acceso temporal vencido a mitad de turno también entra por aquí: el
 * mesero no tiene usuario ni clave, así que mandarlo a `/login` como si se le
 * hubiera cerrado la sesión normal no dice nada útil. Antes de limpiar la
 * sesión se anota si el usuario guardado tenía `accesoHasta` (era temporal)
 * para que `LoginPage` pueda mostrar el mensaje correcto — ver
 * `tomarAvisoAccesoVencido`. Se guarda en `sessionStorage`, no en el store,
 * porque el 401 puede llegar de cualquier pantalla y lo único que sigue vivo
 * hasta que React vuelva a montar `/login` es el storage.
 */
export function handleUnauthorized(): void {
  if (isUsingMockAuth) return;
  const usuario = getStoredUsuario();
  if (usuario?.accesoHasta) {
    try {
      sessionStorage.setItem(ACCESO_VENCIDO_KEY, "1");
    } catch {
      // sessionStorage no disponible: el usuario simplemente verá el login normal.
    }
  }
  clearSession();
}

/**
 * Consume (lee y borra) el aviso dejado por `handleUnauthorized`. Se lee UNA
 * vez al montar `LoginPage` — si se dejara sin borrar, un logout manual
 * posterior en la misma pestaña reabriría el mismo mensaje sin venir de un
 * acceso vencido de verdad.
 */
export function tomarAvisoAccesoVencido(): boolean {
  try {
    const habia = sessionStorage.getItem(ACCESO_VENCIDO_KEY) === "1";
    sessionStorage.removeItem(ACCESO_VENCIDO_KEY);
    return habia;
  } catch {
    return false;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const raw = (body as { message: unknown }).message;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") return raw[0];
  }
  if (status === 401) return "Usuario o clave incorrectos";
  return `Error ${status}`;
}

async function postAuth(path: string, body: unknown): Promise<LoginResult> {
  const base = apiBaseUrl();
  if (!base) throw new ApiError("VITE_API_URL no está configurada", 500);

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }

  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(extractMessage(parsed, response.status), response.status);
  }

  return parsed as LoginResult;
}

const MOCK_USUARIO: Usuario = {
  id: "mock-admin",
  restauranteId: "mock-restaurante",
  nombre: "Administrador (modo demo)",
  usuario: "admin",
  rol: "administrador",
  activo: true,
  ultimoAccesoEn: new Date().toISOString(),
  creadoEn: new Date().toISOString(),
  actualizadoEn: new Date().toISOString(),
  // El modo demo siempre entra como administrador: ve los 11 módulos y no
  // tiene vencimiento. `useAuthStore` trata esto como "módulos ya listos" de
  // inmediato, sin esperar ningún refresco.
  modulos: TODOS_LOS_MODULOS,
  accesoHasta: null,
};

function mockLogin(): Promise<LoginResult> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ token: "mock-token", usuario: MOCK_USUARIO }), 200);
  });
}

/** `POST /api/v1/auth/login` — body `{ usuario, clave }`. */
export async function login(usuario: string, clave: string): Promise<LoginResult> {
  const result = isUsingMockAuth ? await mockLogin() : await postAuth("/auth/login", { usuario, clave });
  persistSession(result.token, result.usuario);
  return result;
}

/** `POST /api/v1/auth/pin` — body `{ usuario, pin }`. Same response shape as `login`. */
export async function loginPin(usuario: string, pin: string): Promise<LoginResult> {
  const result = isUsingMockAuth ? await mockLogin() : await postAuth("/auth/pin", { usuario, pin });
  persistSession(result.token, result.usuario);
  return result;
}

export function logout(): void {
  clearSession();
}

/**
 * Guarda una sesión obtenida por un camino que NO es `login`/`loginPin` —
 * hoy sólo el canje de acceso temporal (`POST /auth/acceso`, que viaja como
 * uno de los 8 métodos de `ApiClient`, no por este archivo, porque es un
 * endpoint público normal y no necesita el fetch a mano de `postAuth`).
 * `useAuthStore.canjearAcceso` llama a `api.canjearAcceso(...)` y después a
 * esto para persistir el resultado exactamente igual que un login.
 */
export function adoptarSesion(token: string, usuario: Usuario): void {
  persistSession(token, usuario);
}

/**
 * `GET /auth/yo` — refresca el usuario guardado (trae `modulos`/`accesoHasta`
 * al día sin tener que volver a iniciar sesión).
 *
 * Existe por la transición del deploy: una sesión abierta ANTES de este
 * cambio tiene el usuario guardado SIN `modulos`, y `usePuedeVer` no puede
 * distinguir eso de "no ve nada" sin ayuda — ver `src/lib/permisos.ts`. Esto
 * es lo que llena ese hueco al arrancar la app (`useModulosBootstrap`, en
 * `useAuthStore.ts`).
 *
 * No usa `httpClient.ts`'s `request()` a propósito: ese módulo IMPORTA
 * `getToken`/`handleUnauthorized` DE AQUÍ, así que este archivo no puede
 * importar de vuelta de `httpClient.ts` sin crear un ciclo. Por eso el fetch
 * se arma a mano, igual que `postAuth`.
 *
 * Devuelve `null` si no se pudo refrescar (sin red, sin token, etc.) — quien
 * llama debe seguir tratando el usuario ya guardado como el mejor dato
 * disponible, nunca como "ahora sabemos que no tiene nada".
 */
export async function obtenerYo(): Promise<Usuario | null> {
  // Modo demo: no hay backend real que preguntarle, y el usuario mock ya
  // nace con `modulos` completos — se devuelve tal cual para que
  // `useModulosBootstrap` marque "listo" de inmediato.
  if (isUsingMockAuth) return getStoredUsuario();

  const base = apiBaseUrl();
  const token = getToken();
  if (!base || !token) return null;

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, "")}/auth/yo`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }

  if (response.status === 401) {
    handleUnauthorized();
    return null;
  }
  if (!response.ok) return null;

  const text = await response.text();
  const usuario = text ? (safeJsonParse(text) as Usuario | undefined) : undefined;
  if (!usuario) return null;

  // El token no cambia con este refresco — sólo se releyó el usuario.
  persistSession(token, usuario);
  return usuario;
}
