import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { IconTile } from "@/components/ui/IconTile";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useActiveProducts, useProductStore } from "@/lib/useProductStore";
import { DualPrice } from "@/components/shared/DualPrice";

export interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  mesaLabel: string;
  onAdd: (productoId: string, cantidad: number) => Promise<void>;
}

export function AddItemModal({ open, onClose, mesaLabel, onAdd }: AddItemModalProps) {
  const status = useProductStore((s) => s.status);
  const load = useProductStore((s) => s.load);
  const productos = useActiveProducts();
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && status === "idle") void load();
  }, [open, status, load]);

  // Arranca en blanco cada vez que se abre — buscador, no lista completa.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return productos
      .filter((p) => p.disponible && p.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos, query]);

  async function handleAdd(productoId: string) {
    setAddingId(productoId);
    try {
      await onAdd(productoId, 1);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Agregar ítem — ${mesaLabel}`}
      description="Busca un producto por nombre para añadirlo a la comanda."
    >
      <div className="flex flex-col gap-3">
        <Input
          label="Buscar producto"
          placeholder="Ej. Tequeños"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="-mx-1 max-h-[50vh] overflow-y-auto px-1">
          {status === "loading" && (
            <p className="py-8 text-center text-sm text-fg-muted">Cargando catálogo…</p>
          )}
          {status === "ready" && query.trim() === "" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <IconTile tone="neutral" size="lg">
                <Search size={22} />
              </IconTile>
              <p className="text-sm text-fg-subtle">Escribe para buscar un producto.</p>
            </div>
          )}
          {status === "ready" && query.trim() !== "" && resultados.length === 0 && (
            <p className="py-10 text-center text-sm text-fg-muted">
              No se encontraron productos con ese nombre.
            </p>
          )}
          {resultados.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {resultados.map((producto) => (
                <li key={producto.id}>
                  <button
                    type="button"
                    disabled={addingId === producto.id}
                    onClick={() => void handleAdd(producto.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-fg">{producto.nombre}</span>
                      <DualPrice usd={producto.precio} className="font-mono text-[12px] tabular-nums text-fg-muted" />
                    </span>
                    <Badge tone="accent" className="shrink-0">
                      <Plus size={12} />
                      Agregar
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
