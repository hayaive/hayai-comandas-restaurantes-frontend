import { useEffect, useRef } from "react";
import { RefreshCw, Receipt, Volume2, VolumeX } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useComandaStore } from "@/lib/useComandaStore";
import { useAlertaCocina } from "@/lib/useAlertaCocina";
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

  // Suena sólo cuando ENTRA una comanda que no estaba, no cada vez que la
  // lista cambia: despachar una también cambia la lista, y premiar eso con un
  // bip entrenaría a la cocina a ignorar el sonido.
  //
  // `null` como valor inicial distingue "todavía no cargué nada" de "la cola
  // está vacía": sin esa distinción, la primera carga con pedidos ya en cola
  // dispararía la alarma al abrir la pantalla.
  // Se depende de `reproducir` (estable vía `useCallback`) y no del objeto
  // `alerta`, que es nuevo en cada render y volvería a disparar este efecto
  // sin motivo.
  const { reproducir } = alerta;
  const idsConocidos = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (status !== "ready") return;
    const actuales = new Set(cola.map((c) => c.comandaId));
    const previos = idsConocidos.current;
    idsConocidos.current = actuales;
    if (previos === null) return;
    const hayNuevas = [...actuales].some((id) => !previos.has(id));
    if (hayNuevas) reproducir();
  }, [cola, status, reproducir]);

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
            <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
