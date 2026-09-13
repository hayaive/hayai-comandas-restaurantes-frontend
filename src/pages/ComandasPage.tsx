import { useEffect, useMemo } from "react";
import { RefreshCw, Receipt } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useComandaStore } from "@/lib/useComandaStore";
import { useSyncComandasWithFloorPlan } from "@/lib/useSyncComandasWithFloorPlan";
import { ComandaCard } from "@/components/comandas/ComandaCard";
import { formatUsd } from "@/lib/format";

export function ComandasPage() {
  const comandas = useComandaStore((s) => s.comandas);
  const status = useComandaStore((s) => s.status);
  const error = useComandaStore((s) => s.error);
  const load = useComandaStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  // Keeps this panel in lockstep with table status changes made in the
  // floor plan editor (occupied → comanda opened, freed manually → cancelled).
  useSyncComandasWithFloorPlan();

  const sorted = useMemo(
    () => [...comandas].sort((a, b) => a.abiertaEn.localeCompare(b.abiertaEn)),
    [comandas],
  );

  // Lo que un encargado quiere saber sin abrir nada: cuánto hay en sala ahora
  // mismo y cuántos platos siguen sin salir de cocina.
  const { enSala, pendientes } = useMemo(() => {
    let total = 0;
    let sinServir = 0;
    for (const comanda of sorted) {
      total += Number(comanda.total);
      for (const item of comanda.items) {
        if (item.estado === "pendiente" || item.estado === "en_preparacion") sinServir += 1;
      }
    }
    return { enSala: total, pendientes: sinServir };
  }, [sorted]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Comandas"
        subtitle={`${sorted.length} ${sorted.length === 1 ? "mesa activa" : "mesas activas"}`}
        actions={
          <Button size="sm" onClick={() => void load()} disabled={status === "loading"}>
            <RefreshCw size={14} className={status === "loading" ? "animate-spin" : undefined} />
            Actualizar
          </Button>
        }
      />

      <PageBody>
        <PageHero
          tone="royal"
          eyebrow="Servicio en curso"
          title="Comandas abiertas"
          description="Cada mesa ocupada tiene su comanda aquí. Marca ítems como servidos a medida que salen, y cobra para liberar la mesa."
          stats={[
            { label: "Mesas", value: sorted.length },
            { label: "En sala", value: formatUsd(enSala) },
            { label: "Por servir", value: pendientes },
          ]}
        />

        {status === "loading" && comandas.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando comandas activas…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<Receipt size={26} />}
            title="No se pudieron cargar las comandas"
            description={error ?? "Ocurrió un error inesperado."}
            action={
              <Button onClick={() => void load()}>Reintentar</Button>
            }
          />
        )}

        {status === "ready" && sorted.length === 0 && (
          <EmptyState
            icon={<Receipt size={26} />}
            title="No hay mesas ocupadas"
            description="Cuando marques una mesa como ocupada en el plano del salón, su comanda aparecerá aquí automáticamente."
          />
        )}

        {sorted.length > 0 && (
          <Section title="En servicio">
            <StaggerGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((comanda) => (
                <ComandaCard key={comanda.id} comanda={comanda} />
              ))}
            </StaggerGrid>
          </Section>
        )}
      </PageBody>
    </div>
  );
}
