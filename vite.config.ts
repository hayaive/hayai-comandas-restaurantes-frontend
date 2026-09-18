import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Explicit "update available" prompt, not silent `autoUpdate`.
      //
      // This app runs on host-stand tablets and waiter phones *during live
      // service* — an order or a floor-plan edit can be mid-flight at any
      // moment. `autoUpdate` would let a background deploy call
      // `skipWaiting()`/`clientsClaim()` on its own schedule and swap the app
      // shell under a tab that's mid-interaction on its own timing.
      // `registerType: 'prompt'` instead only updates+reloads when staff
      // explicitly tap "Actualizar ahora"
      // (`src/components/shared/PwaUpdateBanner.tsx`, mounted once in
      // `App.tsx` via the `useRegisterSW` hook from
      // `virtual:pwa-register/react`). That component now shows a
      // non-dismissible blocking modal once a new version has installed —
      // by owner's decision nobody is allowed to keep working on a stale
      // build — but the reload itself still only ever happens on that
      // explicit tap, never silently mid-order.
      //
      // `strategies: "injectManifest"` (not the default `generateSW`) because
      // Web Push needs a `push`/`notificationclick` listener, and
      // `generateSW` owns the entire SW file — there is no hook to add
      // custom code to it. With `injectManifest`, `src/sw.ts` is OUR file;
      // Workbox only injects the precache manifest into it at build time
      // (the `self.__WB_MANIFEST` placeholder). Everything `generateSW` used
      // to do for us — precache, SPA `navigateFallback`, the `/api/`
      // network-only rule, outdated-cache cleanup, and (critically) the
      // `SKIP_WAITING` message listener that `updateServiceWorker(true)`
      // depends on — is now hand-written in `src/sw.ts`. See the comments
      // there, especially the one on the `message` listener: without it,
      // "Actualizar ahora" in `PwaUpdateBanner` would hang forever, because
      // nothing would ever tell the waiting worker to activate.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // App shell + static build assets only (JS/CSS/fonts/images that
        // `vite build` emits into dist/) — precached so the shell can boot
        // offline/on a flaky Wi-Fi signal. Mismo patrón que el
        // `workbox.globPatterns` de antes de `injectManifest`.
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,ico,woff2}"],
      },
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        name: "Hayai Comandas",
        short_name: "Hayai",
        description:
          "Sistema operativo de restaurante: mesas, comandas, reservaciones y ventas.",
        // From src/styles/tokens.css: --bg (--n-25) and --accent-500, the
        // one brand hue the product uses (see tokens.css/DESIGN.md) — not
        // invented for this task.
        background_color: "#fafafa",
        theme_color: "#6f4a2e",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "es",
        icons: [
          {
            src: "/pwa/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa/maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa/maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      includeAssets: ["favicon.png", "logo.jpg", "pwa/apple-touch-icon.png"],
      // El resto de lo que `workbox.*` configuraba con `generateSW` (SPA
      // `navigateFallback`, la regla NetworkOnly de `/api/`, y el cleanup de
      // caches viejos) ahora vive escrito a mano en `src/sw.ts`, porque
      // `injectManifest` no genera nada de eso automáticamente — sólo
      // sustituye `self.__WB_MANIFEST` por la lista de precache. Ver los
      // comentarios ahí para el porqué de cada pieza.
      devOptions: {
        // Keep the SW out of `vite dev` entirely — nobody needs "install
        // this app" prompts or stale-shell debugging while iterating.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
