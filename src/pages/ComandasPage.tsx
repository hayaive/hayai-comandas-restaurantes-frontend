import { useEffect, useMemo } from "react";
import { RefreshCw, Receipt } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageBody, Section, StaggerGrid } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useComandaStore } from "@/lib/useComandaStore";
import { useSyncComandasWithFloorPlan } from "@/lib/useSyncComandasWithFloorPlan";
import { ComandaCard } from "@/components/comandas/ComandaCard";

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
