import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type TemaPush } from "@/api";

/**
 * Web Push: suscripción del dispositivo y su ciclo de vida.
 *
 * Complementa a `useAlertaCocina.ts`, no lo reemplaza — ese hook cubre "app
 * abierta, aunque sea en segundo plano" con `registration.showNotification`
 * llamado desde el hilo principal; esto cubre "app CERRADA del todo", que
 * sólo puede disparar el navegador al recibir un push, desde `src/sw.ts`
 * (listener `push`). Ambos caminos terminan en la misma UI del sistema — el
 * doble aviso (in-app + push) es intencional: cada uno falla en un escenario
 * distinto, igual que audio/vibración/notificación en `useAlertaCocina.ts`.
 *
 * Temas suscritos por defecto: los dos que el backend ya emite hoy
 * (`CONTRACT.md` del backend, sección push) — pedir `cuenta_por_cobrar` o
 * `reservacion_nueva` no traería nada todavía, así que no se ofrecen aquí.
 */
const TEMAS_DESPACHO: TemaPush[] = ["comanda_cocina", "comanda_barra"];

// --- Detección de plataforma ---------------------------------------------

function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se identifica como "Macintosh" en el user agent; la única
  // forma de distinguirlo de un Mac de verdad es que además reporta soporte
  // táctil multitouch, que ningún Mac con mouse/trackpad tiene.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function corriendoComoAppInstalada(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  // `navigator.standalone` es específico de Safari/iOS y no está en
  // lib.dom.d.ts — de ahí el cast. `display-mode: standalone` es el
  // equivalente estándar (Android/desktop), se comprueba también por si
  // algún Safari futuro lo adopta.
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/**
 * iOS/iPadOS (16.4+) sólo entrega Web Push a una PWA instalada en la
 * pantalla de inicio — en una pestaña normal de Safari nunca llega nada,
 * por más que se pida permiso y se suscriba. Antes de esto, `window.PushManager`
 * directamente no existe en Safari. Cualquiera de los dos casos es "hace
 * falta instalar primero", así que se detectan juntos.
 */
export function necesitaInstalarseParaPush(): boolean {
  return esIOS() && !corriendoComoAppInstalada();
}

function soportaServiceWorkerYPush(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window
  );
}

/** "¿Puede este dispositivo, tal cual está ahora, recibir Web Push?" */
export function esPushSoportado(): boolean {
  return soportaServiceWorkerYPush() && !necesitaInstalarseParaPush();
}

// --- Codificación de claves -------------------------------------------
// Dos codificaciones DISTINTAS a propósito, cada una la que exige su lado:
//
// - La clave pública VAPID que da el backend viaja en base64url (RFC 4648 §5,
//   sin `+`/`/` ni relleno `=`) porque así la expone la Web Push API en la
//   práctica; `applicationServerKey` necesita los bytes crudos.
// - `p256dh`/`auth` de `subscription.getKey(...)` se mandan al backend en
//   base64 ESTÁNDAR (con `+`/`/`/`=`) — así los valida el CHECK del backend.
//   Confundir una con la otra produce un string que decodifica distinto (o
//   directo no decodifica) del lado del servidor y el POST vuelve con 400.

function base64UrlAUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  // TS 5.7+ tipa `new Uint8Array(length)` como `Uint8Array<ArrayBufferLike>`
  // (podría respaldarse en un `SharedArrayBuffer`), que `applicationServerKey`
  // no acepta — de ahí construirlo sobre un `ArrayBuffer` explícito.
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}

function serializarSuscripcion(suscripcion: PushSubscription, temas: TemaPush[]) {
  const p256dh = suscripcion.getKey("p256dh");
  const auth = suscripcion.getKey("auth");
  if (!p256dh || !auth) {
    // No debería pasar en un navegador que soporta Push, pero si pasa es
    // mejor fallar explícito que mandar "[object ArrayBuffer]" al backend —
    // justo lo que el CHECK del lado del servidor existe para rechazar.
    throw new Error("El navegador no expuso las claves de la suscripción push");
  }
  return {
    endpoint: suscripcion.endpoint,
    p256dh: arrayBufferABase64(p256dh),
    auth: arrayBufferABase64(auth),
    expirationTime: suscripcion.expirationTime ?? null,
    temas,
  };
}

const CODIGO_OTRO_RESTAURANTE = "SUSCRIPCION_DE_OTRO_RESTAURANTE";

function esConflictoDeOtroRestaurante(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.message.toUpperCase().includes(CODIGO_OTRO_RESTAURANTE)
  );
}

/**
 * Manda la suscripción actual al backend. Si el endpoint quedó asociado a
 * OTRO restaurante (dispositivo compartido, o una sesión anterior con otra
 * cuenta) el backend responde 409 — el endpoint del navegador no se puede
 * "liberar", así que la única salida es desuscribirse y pedir uno nuevo. Se
 * reintenta UNA sola vez para no entrar en un loop si el backend está mal
 * configurado.
 */
async function enviarSuscripcion(
  suscripcion: PushSubscription,
  temas: TemaPush[],
  reintentar = true,
): Promise<void> {
  try {
    await api.crearSuscripcionPush(serializarSuscripcion(suscripcion, temas));
  } catch (error) {
    if (reintentar && esConflictoDeOtroRestaurante(error)) {
      await suscripcion.unsubscribe();
      const registro = await navigator.serviceWorker.ready;
      const { clavePublica } = await api.getClaveVapid();
      const nueva = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlAUint8Array(clavePublica),
      });
      await enviarSuscripcion(nueva, temas, false);
      return;
    }
    throw error;
  }
}

async function obtenerOSuscribir(clavePublica: string): Promise<PushSubscription> {
  const registro = await navigator.serviceWorker.ready;
  const existente = await registro.pushManager.getSubscription();
  if (existente) return existente;
  return registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlAUint8Array(clavePublica),
  });
}

export type ResultadoActivarPush =
  | { ok: true }
  | {
      ok: false;
      motivo: "no-soportado" | "sin-permiso" | "error";
      /** Qué falló exactamente, para poder MOSTRARLO en vez de tragárselo. */
      detalle?: string;
    };

/**
 * Pide permiso (si hace falta), obtiene la clave VAPID, suscribe al
 * navegador y manda la suscripción al backend. Pensado para llamarse desde
 * un gesto real del usuario (el tap en "Activar avisos" de `ComandasPage`) —
 * `Notification.requestPermission()` exige eso igual que
 * `pedirPermisoNotificaciones` en `useAlertaCocina.ts`.
 */
export async function activarPush(temas: TemaPush[] = TEMAS_DESPACHO): Promise<ResultadoActivarPush> {
  if (!esPushSoportado()) return { ok: false, motivo: "no-soportado" };

  let permiso = Notification.permission;
  if (permiso === "default") {
    permiso = await Notification.requestPermission();
  }
  if (permiso !== "granted") return { ok: false, motivo: "sin-permiso" };

  try {
    const { clavePublica } = await api.getClaveVapid();
    const suscripcion = await obtenerOSuscribir(clavePublica);
    await enviarSuscripcion(suscripcion, temas);
    return { ok: true };
  } catch (error) {
    // El mensaje sube hasta la pantalla. Antes sólo iba a `console.error` y el
    // usuario veía el botón volver a su sitio sin explicación: una suscripción
    // que falla y una que nunca se intentó se veían EXACTAMENTE igual, que es
    // lo que hace imposible diagnosticar esto desde el salón.
    console.error("No se pudo activar el aviso push:", error);
    return {
      ok: false,
      motivo: "error",
      detalle: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * El latido que mantiene viva la fila del backend: el navegador puede rotar
 * el `endpoint` de una suscripción sin avisar (renovación silenciosa de
 * Chrome/Firefox), así que reenviar lo que `getSubscription()` devuelva en
 * cada arranque es la única forma de que el backend se entere. Si nunca hubo
 * suscripción (usuario que jamás tocó "Activar avisos", o la revocó) no hace
 * nada — no es su trabajo suscribir por primera vez, eso es `activarPush`,
 * que exige el gesto explícito del usuario.
 */
export async function revalidarSuscripcionPush(temas: TemaPush[] = TEMAS_DESPACHO): Promise<void> {
  if (!soportaServiceWorkerYPush()) return;
  try {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) return;
    await enviarSuscripcion(suscripcion, temas);
  } catch (error) {
    // El latido es un extra: si falla, el próximo arranque lo reintenta. No
    // puede romper el boot de la app por un backend caído un momento.
    console.error("No se pudo revalidar la suscripción push:", error);
  }
}

/**
 * Bootstrap de app, montado en `AppShell` junto a los demás
 * (`useFloorPlanBootstrap`, `useComandaBootstrap`, `useAlertaCocinaBootstrap`).
 * Sólo revalida cuando YA hay permiso concedido — si todavía está en
 * `"default"`, no hay nada suscrito que revalidar y pedir permiso solo, sin
 * gesto del usuario, el navegador lo ignora o lo penaliza igual que en
 * `useAlertaCocina.ts`.
 */
export function usePushSubscriptionBootstrap(): void {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    void revalidarSuscripcionPush();
    // Sólo al montar: es un latido de arranque, no algo que deba repetirse
    // en cada re-render de AppShell. `revalidarSuscripcionPush` es una
    // función de módulo estable (no un valor que cambie entre renders), así
    // que el array de deps vacío es correcto, no un escape del linter.
  }, []);
}

// --- Estado honesto para la UI --------------------------------------------

export type EstadoPush =
  | "verificando"
  | "suscrito"
  | "sin-permiso"
  | "permiso-denegado"
  | "no-soportado"
  | "requiere-instalar-ios";

interface UsoPushSubscripcion {
  estado: EstadoPush;
  activando: boolean;
  activar: () => Promise<void>;
  /** Por qué falló el último intento, o `null`. La pantalla DEBE mostrarlo. */
  error: string | null;
}

/**
 * Todo lo que `ComandasPage` necesita para el botón "Activar avisos": el
 * estado real (no uno optimista) y la acción. `recalcular` es async porque
 * saber si YA hay una suscripción activa exige preguntarle al
 * `ServiceWorkerRegistration`, no hay forma de saberlo de forma síncrona.
 */
export function usePushSubscripcion(temas: TemaPush[] = TEMAS_DESPACHO): UsoPushSubscripcion {
  const [estado, setEstado] = useState<EstadoPush>("verificando");
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recalcular = useCallback(async () => {
    if (necesitaInstalarseParaPush()) {
      setEstado("requiere-instalar-ios");
      return;
    }
    if (!soportaServiceWorkerYPush()) {
      setEstado("no-soportado");
      return;
    }
    const permiso = typeof Notification === "undefined" ? "denied" : Notification.permission;
    if (permiso === "denied") {
      setEstado("permiso-denegado");
      return;
    }
    if (permiso === "default") {
      setEstado("sin-permiso");
      return;
    }
    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      setEstado(suscripcion ? "suscrito" : "sin-permiso");
    } catch {
      // No se pudo confirmar contra el SW: mejor ofrecer el botón de nuevo
      // que fingir que ya está suscrito.
      setEstado("sin-permiso");
    }
  }, []);

  useEffect(() => {
    void recalcular();
  }, [recalcular]);

  const activar = useCallback(async () => {
    setActivando(true);
    setError(null);
    try {
      const resultado = await activarPush(temas);
      if (!resultado.ok) {
        setError(
          resultado.motivo === "sin-permiso"
            ? "El navegador denegó el permiso de notificaciones. Hay que concederlo desde la configuración del sitio."
            : resultado.motivo === "no-soportado"
              ? "Este navegador no admite notificaciones push."
              : (resultado.detalle ?? "No se pudo activar el aviso."),
        );
      }
    } finally {
      setActivando(false);
      await recalcular();
    }
  }, [temas, recalcular]);

  return { estado, activando, activar, error };
}
