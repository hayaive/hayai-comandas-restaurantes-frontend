import { RefreshCw, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

/**
 * Explicit "an update is available" affordance for the installed PWA.
 *
 * `vite.config.ts` runs the service worker with `registerType: 'prompt'`
 * (see the comment there for why) instead of `autoUpdate`: this app is used
 * live during service, so nothing should swap the running app shell out from
 * under a host or waiter mid-order. This banner is the other half of that
 * choice — it is how staff actually get off a stale build: it appears the
 * moment a new deploy's service worker has installed and stays up (it does
 * not auto-dismiss) until someone taps "Actualizar", which calls
 * `updateSW(true)` to activate the new worker and reload. Nobody is stuck on
 * an old build, but the reload always happens on their terms.
 *
 * Also doubles as the "offline ready" confirmation the same hook exposes,
 * since both are one-shot service-worker lifecycle notices with the same
 * shape (a line of text + a dismiss).
 */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Error registrando el service worker:", error);
    },
  });

  if (!needRefresh && !offlineReady) {
    return null;
  }

  function close() {
    setNeedRefresh(false);
    setOfflineReady(false);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:justify-end sm:pr-6">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface-raised px-4 py-3 shadow-[var(--shadow-token-lg)]">
        {needRefresh ? (
          <>
            <RefreshCw className="size-4 shrink-0 text-accent" aria-hidden />
            <p className="flex-1 text-sm text-fg">
              Hay una actualización de Hayai Comandas disponible.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => updateServiceWorker(true)}
            >
              Actualizar
            </Button>
          </>
        ) : (
          <>
            <WifiOff className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <p className="flex-1 text-sm text-fg">
              Hayai Comandas ya funciona sin conexión.
            </p>
          </>
        )}
        <IconButton
          icon={<X className="size-4" aria-hidden />}
          label="Cerrar"
          onClick={close}
          size="sm"
        />
      </div>
    </div>
  );
}
