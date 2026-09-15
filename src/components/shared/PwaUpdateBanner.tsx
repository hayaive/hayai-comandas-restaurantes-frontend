import { useEffect, useRef } from "react";
import { WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";

/**
 * How often an already-open tab asks the browser to re-check `sw.js` against
 * the server. This app runs on host-stand tablets and waiter phones that can
 * stay open for a full shift without ever being refreshed manually, so
 * `registration.update()` is the only thing that notices a new deploy on
 * those devices. 20 minutes is the balance: frequent enough that staff are
 * never more than one shift-length behind a fix, infrequent enough that it's
 * a handful of tiny conditional requests per shift, not per-minute chatter.
 * It's re-armed on `visibilitychange` too, so a phone that was locked/
 * backgrounded checks again the moment someone picks it back up, instead of
 * waiting out the rest of the interval.
 */
const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 1000;

/**
 * "An update is available" affordance for the installed PWA — and, since the
 * owner explicitly asked for it, the thing that keeps staff off a stale build
 * by force.
 *
 * `vite.config.ts` runs the service worker with `registerType: 'prompt'`
 * (see the comment there): nothing swaps the app shell out from under a
 * host or waiter mid-order on its own. What changed here is *how* that
 * prompt is presented once it fires. It used to be a dismissible toast a
 * busy tablet could sit next to for days; the owner asked for staff to be
 * unable to keep working on the old build once a new one exists, so
 * `needRefresh` now opens a full-screen, non-dismissible `Modal` (no close
 * button, no outside click, no Escape — see `dismissible={false}` on
 * `Modal`) with a single "Actualizar ahora" action that calls
 * `updateServiceWorker(true)`. There is deliberately no countdown or
 * dismissible pre-warning before it: a second dismissible step would just
 * recreate the "ignore it indefinitely" problem this change exists to fix,
 * and a device that sits untouched for hours could miss a transient toast
 * entirely. The modal itself, appearing the instant the new build is ready,
 * *is* the notice — reloading only ever happens on the explicit tap, so
 * nothing is lost silently.
 *
 * `updateServiceWorker(true)` reloads the current tab — whatever the user
 * was doing on THIS screen (an in-progress form, a half-built comanda) is
 * gone the moment they tap it, same as any full-page reload. That's the
 * unavoidable cost of "update now", not something this component can soften
 * further; the non-dismissible modal is what stops it from happening
 * silently in the background instead.
 *
 * "Offline ready" keeps its old, harmless toast — it's not an interruption
 * that needs blocking, just a one-shot confirmation.
 */
export function PwaUpdateBanner() {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration;
    },
    onRegisterError(error) {
      console.error("Error registrando el service worker:", error);
    },
  });

  useEffect(() => {
    function checkForUpdate() {
      registrationRef.current?.update().catch((error) => {
        console.error("Error buscando una nueva versión del service worker:", error);
      });
    }

    const intervalId = window.setInterval(
      checkForUpdate,
      UPDATE_CHECK_INTERVAL_MS,
    );

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      <Modal
        open={needRefresh}
        onClose={() => {}}
        dismissible={false}
        title="Nueva versión disponible"
        description="Hayai Comandas se actualizó. Actualiza ahora para seguir usando la aplicación."
        footer={
          <Button
            variant="primary"
            onClick={() => updateServiceWorker(true)}
          >
            Actualizar ahora
          </Button>
        }
      >
        <p className="text-sm text-fg-muted">
          Esto puede cerrar cualquier acción sin guardar en esta pantalla. La
          aplicación se recargará con la versión más reciente.
        </p>
      </Modal>

      {offlineReady && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:justify-end sm:pr-6">
          <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface-raised px-4 py-3 shadow-[var(--shadow-token-lg)]">
            <WifiOff className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <p className="flex-1 text-sm text-fg">
              Hayai Comandas ya funciona sin conexión.
            </p>
            <IconButton
              icon={<X className="size-4" aria-hidden />}
              label="Cerrar"
              onClick={() => setOfflineReady(false)}
              size="sm"
            />
          </div>
        </div>
      )}
    </>
  );
}
