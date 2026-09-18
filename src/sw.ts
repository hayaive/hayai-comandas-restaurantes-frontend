/// <reference lib="webworker" />

/**
 * Service worker propio (`strategies: "injectManifest"` en `vite.config.ts`).
 *
 * Compila con `tsconfig.sw.json`, NO con `tsconfig.app.json`: este archivo
 * corre en `ServiceWorkerGlobalScope`, que necesita la lib TS "WebWorker" —
 * incompatible con la lib "DOM" que usa el resto de la app en el mismo
 * programa (ambas declaran el global `self` con tipos distintos).
 *
 * `self.__WB_MANIFEST` es el placeholder que `vite-plugin-pwa` sustituye en
 * build por la lista real de assets a precachear — su tipo lo trae
 * `workbox-precaching` vía `declare global`, no hace falta declararlo aquí.
 */
declare const self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

// --- Precache del app shell -------------------------------------------
// Reemplaza lo que `generateSW` hacía solo: precachea todo lo que
// `injectManifest.globPatterns` (vite.config.ts) recolectó del build y añade
// las rutas de fetch correspondientes.
precacheAndRoute(self.__WB_MANIFEST);

// Los precaches de una versión anterior del SW se borran en cuanto ésta
// activa, para que un app shell viejo nunca quede colgado en caché.
cleanupOutdatedCaches();

// --- Datos operativos: NUNCA se sirven desde caché ----------------------
// Comandas/mesas/productos/reservaciones/ventas son datos vivos, no
// contenido — cachearlos mostraría al mesero una mesa libre que ya no lo
// está. `httpClient.ts` puede apuntar a un origen distinto o a un mismo-
// origen `/api/...` según el deploy, así que el patrón cubre ambas formas.
// Se registra ANTES que el fallback de navegación para que gane si algún día
// una ruta de API llegara como navegación.
registerRoute(({ url }) => /\/api\//.test(url.href), new NetworkOnly());

// --- SPA fallback ---------------------------------------------------------
// Deep links (reabrir directo en /comandas) resuelven al shell cacheado en
// vez de un 404 de red cuando no hay conexión. `createHandlerBoundToURL`
// exige que "/index.html" esté en el precache — lo está, vía globPatterns.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/\/api\//],
  }),
);

// --- registerType: "prompt" -----------------------------------------------
// `vite.config.ts` explica por qué el SW no debe activar solo. Con
// `generateSW`, Workbox inyectaba este mismo listener por nosotros; con
// `injectManifest` el archivo es nuestro, así que hay que escribirlo. SIN
// ESTO, "Actualizar ahora" en `PwaUpdateBanner.tsx` se queda colgado para
// siempre: `updateServiceWorker(true)` (vía `virtual:pwa-register/react`)
// manda este mensaje exacto al worker en `waiting` a través de
// `workbox-window`'s `messageSkipWaiting()`, y nada más en todo el flujo
// llama a `self.skipWaiting()`. A propósito NO hay un `self.skipWaiting()`
// en `install`: eso es justo lo que "prompt" existe para evitar — un deploy
// de fondo no puede tomar control de una pestaña a mitad de un pedido.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Web Push ---------------------------------------------------------
// Esto es lo nuevo que `generateSW` no podía darnos: un listener de `push`
// que sobrevive con la app CERRADA del todo. `useAlertaCocina.ts` ya cubre
// "app abierta en background" con `registration.showNotification` llamado
// desde el hilo principal; esto es el mismo mecanismo pero disparado por el
// navegador cuando llega un push del backend, sin que haya ninguna pestaña
// viva. Ver `src/lib/pushSubscription.ts` para cómo se registra la
// suscripción que hace posible que el backend nos encuentre.

/** Forma del payload que manda el backend en el push (`web-push`, VAPID). */
interface PushPayload {
  titulo?: string;
  cuerpo?: string;
  /** Agrupa notificaciones relacionadas — mismo propósito que en `useAlertaCocina.ts`. */
  etiqueta?: string;
  /** Ruta a abrir/enfocar al tocar la notificación. Default `/comandas`. */
  ruta?: string;
}

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    // El backend siempre manda JSON, pero un push sin `data` (o con un
    // payload que no lo sea) no puede tumbar el listener: se muestra una
    // notificación genérica en vez de fallar en silencio.
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = {};
  }

  const titulo = payload.titulo ?? "Hayai Comandas";
  const opciones: NotificationOptions = {
    body: payload.cuerpo,
    icon: "/logo.jpg",
    badge: "/logo-mono.png",
    tag: payload.etiqueta,
    // Igual que en `useAlertaCocina.ts`: sin esto, Android la descarta sola
    // en pocos segundos y con la app cerrada nadie la vuelve a ver.
    requireInteraction: true,
    data: { ruta: payload.ruta ?? "/comandas" },
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ruta = (event.notification.data as { ruta?: string } | undefined)?.ruta ?? "/comandas";

  event.waitUntil(
    (async () => {
      // Reusa una pestaña ya abierta de la app en vez de amontonar otra —
      // el pase de cocina suele tener la tablet ya abierta en Despacho.
      // `includeUncontrolled` importa: sin él, una pestaña que quedó fuera
      // del scope de ESTE service worker (p. ej. abierta antes de que el SW
      // tomara control) no aparece en `matchAll` y se abriría una segunda de
      // más aunque la primera siga ahí.
      const clientesAbiertos = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const cliente of clientesAbiertos) {
        // Sólo se enfoca, nunca se fuerza la navegación: igual que
        // `PwaUpdateBanner`, esta app evita jalar al personal fuera de una
        // pantalla a mitad de una acción sin que lo pida explícitamente.
        await cliente.focus();
        return;
      }
      await self.clients.openWindow(ruta);
    })(),
  );
});
