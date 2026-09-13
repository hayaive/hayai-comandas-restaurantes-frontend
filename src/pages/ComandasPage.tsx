import { useEffect } from "react";
import { ArrowClockwise, Receipt } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
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

  const sorted = [...comandas].sort((a, b) => a.abiertaEn.localeCompare(b.abiertaEn));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Comandas"
        subtitle={`${sorted.length} ${sorted.length === 1 ? "mesa activa" : "mesas activas"}`}
        actions={
          <Button variant="nav" size="sm" onClick={() => void load()} disabled={status === "loading"}>
            <ArrowClockwise size={14} className={status === "loading" ? "animate-spin" : undefined} />
            Actualizar
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {status === "loading" && comandas.length === 0 && (
          <p className="py-10 text-center text-[13px] text-fg-muted">Cargando comandas activas…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<Receipt size={26} weight="duotone" />}
            title="No se pudieron cargar las comandas"
            description={error ?? "Ocurrió un error inesperado."}
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        )}

        {status === "ready" && sorted.length === 0 && (
          <EmptyState
            icon={<Receipt size={26} weight="duotone" />}
            title="No hay mesas ocupadas"
            description="Cuando marques una mesa como ocupada en el editor de plano, su comanda aparecerá aquí automáticamente."
          />
        )}

        {sorted.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((comanda) => (
              <ComandaCard key={comanda.id} comanda={comanda} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
