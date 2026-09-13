import { useEffect, useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useProductStore } from "@/lib/useProductStore";
import { formatUsd } from "@/lib/format";

export interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  mesaLabel: string;
  onAdd: (productoId: string, cantidad: number) => Promise<void>;
}

export function AddItemModal({ open, onClose, mesaLabel, onAdd }: AddItemModalProps) {
  const { categorias, productos, status, load } = useProductStore();
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && status === "idle") void load();
  }, [open, status, load]);

  const byCategory = useMemo(() => {
    const disponibles = productos.filter((p) => p.activo && p.disponible);
    return categorias
      .map((cat) => ({
        categoria: cat,
        productos: disponibles.filter((p) => p.categoriaId === cat.id),
      }))
      .filter((group) => group.productos.length > 0);
  }, [categorias, productos]);

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
      description="Toca un producto para añadirlo a la comanda."
    >
      <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
        {status === "loading" && (
          <p className="py-6 text-center text-[13px] text-fg-muted">Cargando catálogo…</p>
        )}
        {status === "ready" && byCategory.length === 0 && (
          <p className="py-6 text-center text-[13px] text-fg-muted">
            No hay productos disponibles en el catálogo.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {byCategory.map(({ categoria, productos: items }) => (
            <div key={categoria.id}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                {categoria.nombre}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((producto) => (
                  <li key={producto.id}>
                    <button
                      type="button"
                      disabled={addingId === producto.id}
                      onClick={() => void handleAdd(producto.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60"
                    >
                      <span className="flex flex-col">
                        <span className="text-[13px] font-medium text-fg">{producto.nombre}</span>
                        <span className="font-mono text-[12px] text-fg-muted">
                          {formatUsd(producto.precio)}
                        </span>
                      </span>
                      <Badge tone="accent" className="shrink-0">
                        <Plus size={12} weight="bold" />
                        Agregar
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
