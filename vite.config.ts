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
      workbox: {
        // App shell + static build assets only (JS/CSS/fonts/images that
        // `vite build` emits into dist/) — precached so the shell can boot
        // offline/on a flaky Wi-Fi signal.
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,ico,woff2}"],
        // SPA deep links (e.g. reopening straight into /comandas) resolve to
        // the cached shell instead of a network 404 when offline.
        navigateFallback: "/index.html",
        // Comandas/mesas/productos/reservaciones/ventas are live operational
        // data, not content — they must NEVER be served from a cache. There
        // is deliberately no `runtimeCaching` entry that matches them, so
        // every request that isn't a precached static asset falls straight
        // through to the network exactly like it would with no service
        // worker at all. `httpClient.ts`'s API base (`VITE_API_URL`) can be
        // a different origin or a same-origin `/api/...` path depending on
        // deployment, so the fallback pattern below covers `/api/` matches
        // under either shape as an explicit, self-documenting NetworkOnly
        // rule rather than relying only on "nothing else matches it".
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: "NetworkOnly",
          },
        ],
        // Old precache entries are dropped as soon as the new SW activates,
        // so a stale app shell never lingers in the cache after an update.
        cleanupOutdatedCaches: true,
      },
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
