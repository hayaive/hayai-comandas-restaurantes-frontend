import { ApiError } from "./types";

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

export interface Usuario {
  id: string;
  restauranteId: string;
  nombre: string;
  usuario: string;
  rol: string;
  activo: boolean;
  ultimoAccesoEn: string;
  creadoEn: string;
  actualizadoEn: string;
}

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

/** Called by `httpClient.ts` when the real backend answers 401 on a protected call. */
export function handleUnauthorized(): void {
  if (isUsingMockAuth) return;
  clearSession();
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
