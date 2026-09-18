import { useEffect, useState } from "react";
import { api, ApiError } from "@/api";
import { Bell, BellOff, BellRing, RefreshCw, Receipt, Volume2, VolumeX } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useComandaStore } from "@/lib/useComandaStore";
import { useAlertaCocina } from "@/lib/useAlertaCocina";
import { usePushSubscripcion } from "@/lib/pushSubscription";
import { ComandaCard } from "@/components/comandas/ComandaCard";

/**
 * La cola de despacho — la pantalla de cocina/barra (KDS).
 *
 * Es UNA sola cola, global a todas las mesas y en orden estricto de llegada:
 * ese orden es lo que hace justa la cocina, así que se respeta el que manda el
 * backend (`ORDER BY creada_en`) en vez de reordenar aquí. La unidad es la
 * COMANDA, no el ítem: cocina y barra despachan el pedido entero.
 *
 * Sin WebSocket todavía (el backend no tiene gateway aún), así que refresca por
 * polling. Cuando exista, se reemplaza `loadCola()` por el push y el resto de
 * la pantalla no cambia.
 */

/**
 * 6s: la cocina tiene que enterarse de un pedido nuevo casi al instante, y
 * `GET /despacho/cola` es una sola consulta indexada con los ítems ya
 * embebidos (sin N+1). El plano, que es menos urgente, sigue en 15s.
 */
const POLL_INTERVAL_MS = 6_000;

export function ComandasPage() {
  const cola = useComandaStore((s) => s.cola);
  const status = useComandaStore((s) => s.colaStatus);
  const error = useComandaStore((s) => s.colaError);
  const loadCola = useComandaStore((s) => s.loadCola);
  const alerta = useAlertaCocina();
  const push = usePushSubscripcion();
  const [probando, setProbando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);

  /**
   * Pide al servidor que empuje un push de prueba a este usuario y muestra el
   * resultado tal cual. El backend ya devuelve una frase en español que dice
   * dónde se rompió la cadena; aquí no se interpreta, se enseña.
   */
  async function probar() {
    setProbando(true);
    setDiagnostico(null);
    try {
      const r = await api.probarPush();
      const detalle = r.fallos.map((f) => `· ${f.status}: ${f.que}`).join("\n");
      setDiagnostico(detalle ? `${r.diagnostico}\n${detalle}` : r.diagnostico);
    } catch (err) {
      setDiagnostico(
        err instanceof ApiError ? err.message : "No se pudo contactar al servidor para la prueba.",
      );
    } finally {
      setProbando(false);
    }
  }

  useEffect(() => {
    void loadCola();
  }, [loadCola]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (useComandaStore.getState().colaStatus === "loading") return;
      void loadCola();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadCola]);

  // La detección de comandas nuevas ya NO vive aquí: se mudó a
  // `useAlertaCocinaBootstrap`, montado en `AppShell`, para que la alarma
  // suene desde cualquier pantalla y no sólo con esta abierta. Aquí quedan
  // sólo los controles, que actúan sobre ese mismo store.

  const cargandoInicial = status === "loading" && cola.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Cola de despacho"
        subtitle={
          cola.length === 1 ? "1 pedido esperando" : `${cola.length} pedidos esperando`
        }
        actions={
          <>
            {/* Mientras la alarma suena, callarla es la acción urgente: el
                cocinero ya la oyó y necesita apagarla sin buscar el toggle. */}
            {alerta.sonando && (
              <Button size="sm" variant="primary" onClick={alerta.detener}>
                <BellOff size={14} /> Silenciar
              </Button>
            )}
            {/* Pide permiso Y suscribe push en el mismo tap — antes esto sólo
                pedía el permiso de `useAlertaCocina.ts` (aviso in-app, muere
                con la pestaña cerrada). Ver `src/lib/pushSubscription.ts`:
                `usePushSubscripcion` decide el estado real preguntándole al
                `ServiceWorkerRegistration`, nunca se asume. */}
            {push.estado === "sin-permiso" && (
              <Button
                size="sm"
                onClick={() => void push.activar()}
                disabled={push.activando}
                title="Recibe un aviso en el teléfono aunque la app esté cerrada del todo"
              >
                <Bell size={14} /> {push.activando ? "Activando…" : "Activar avisos"}
              </Button>
            )}
            {push.estado === "suscrito" && (
              <>
                <span
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[12px] text-fg-muted"
                  title="Este dispositivo recibe avisos de pedidos nuevos aunque la app esté cerrada"
                >
                  <BellRing size={14} /> Avisos activos
                </span>
                {/* Sin esto, "no me llegan las notificaciones" es indiagnosticable
                    desde el salón: una suscripción que nunca se registró, un
                    service worker viejo y unas claves VAPID mal puestas se ven
                    todos igual — no pasa nada. Esto dice cuál de los tres es. */}
                <Button size="sm" onClick={() => void probar()} disabled={probando}>
                  <BellRing size={14} /> {probando ? "Probando…" : "Probar aviso"}
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={alerta.alternar}
              aria-pressed={alerta.activa}
              title={
                alerta.bloqueadaPorNavegador
                  ? "El navegador bloquea el sonido hasta que toques la pantalla"
                  : alerta.activa
                    ? "Silenciar el aviso de pedidos nuevos"
                    : "Activar el aviso de pedidos nuevos"
              }
            >
              {alerta.activa ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {alerta.activa ? "Sonido" : "Silencio"}
            </Button>
            <Button size="sm" onClick={() => void loadCola()} disabled={status === "loading"}>
              <RefreshCw size={14} className={status === "loading" ? "animate-spin" : undefined} />
              Actualizar
            </Button>
          </>
        }
      />

      <PageBody>
        {alerta.bloqueadaPorNavegador && (
          <p
            role="status"
            className="rounded-[var(--radius-md)] border border-border bg-surface-sunken px-3.5 py-2.5 text-[12px] leading-relaxed text-fg-muted"
          >
            El navegador no deja sonar el aviso hasta que alguien toque la pantalla una vez. Un
            toque en cualquier parte lo habilita para todo el turno.
          </p>
        )}

        {/* Safari en iPhone/iPad sólo entrega Web Push a una PWA instalada en
            la pantalla de inicio (iOS 16.4+) — en una pestaña normal nunca
            llega nada, por más permiso que se pida. Mejor decirlo que ofrecer
            un botón "Activar avisos" que jamás va a funcionar ahí. */}
        {/* Activar los avisos fallaba EN SILENCIO: el botón volvía a su sitio
            y no se distinguía de no haberlo tocado nunca. */}
        {push.error && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-danger"
          >
            No se pudieron activar los avisos: {push.error}
          </p>
        )}

        {diagnostico && (
          <p
            role="status"
            className="whitespace-pre-line rounded-[var(--radius-md)] border border-border bg-surface-sunken px-3.5 py-2.5 text-[12px] leading-relaxed text-fg-muted"
          >
            {diagnostico}
          </p>
        )}

        {push.estado === "requiere-instalar-ios" && (
          <p
            role="status"
            className="rounded-[var(--radius-md)] border border-border bg-surface-sunken px-3.5 py-2.5 text-[12px] leading-relaxed text-fg-muted"
          >
            En iPhone/iPad, los avisos con la app cerrada sólo llegan si Hayai Comandas está
            añadida a la pantalla de inicio. Usa "Compartir" → "Añadir a pantalla de inicio" y
            vuelve a entrar desde ese ícono.
          </p>
        )}

        {cargandoInicial && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando la cola…</p>
        )}

        {status === "error" && cola.length === 0 && (
          <EmptyState
            icon={<Receipt size={26} />}
            title="No se pudo cargar la cola"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void loadCola()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && cola.length === 0 && (
          <EmptyState
            icon={<Receipt size={26} />}
            title="No hay pedidos en cola"
            description="Cuando un mesero envíe un pedido a cocina aparecerá aquí, en orden de llegada, y sonará un aviso."
          />
        )}

        {cola.length > 0 && (
          <Section
            title="En orden de llegada"
            action={
              <span className="font-mono text-[12px] tabular-nums text-fg-subtle">
                el más viejo primero
              </span>
            }
          >
            {/* Las tarjetas ahora llevan mucho más texto (nombres y notas sin
                truncar, tipografía más grande) — a `sm` (640px) dos columnas
                las dejaba angostísimas. Una sola columna hasta `lg` (1024px,
                lo típico de un tablet en horizontal), dos hasta `2xl`, y
                recién a partir de ahí tres; en el teléfono sigue siendo una
                sola columna. */}
            <StaggerGrid className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {cola.map((comanda) => (
                <ComandaCard key={comanda.comandaId} comanda={comanda} />
              ))}
            </StaggerGrid>
          </Section>
        )}
      </PageBody>
    </div>
  );
}
