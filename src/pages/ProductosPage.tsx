import { useEffect, useState } from "react";
import { Package, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Switch } from "@/components/ui/Switch";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProductStore } from "@/lib/useProductStore";
import { ProductFormModal } from "@/components/productos/ProductFormModal";
import { ProductThumbnail } from "@/components/productos/ProductThumbnail";
import { DualPrice } from "@/components/shared/DualPrice";
import type { Producto } from "@/api";

export function ProductosPage() {
  const status = useProductStore((s) => s.status);
  const error = useProductStore((s) => s.error);
  const productos = useProductStore((s) => s.productos);
  const load = useProductStore((s) => s.load);
  const toggleDisponibilidad = useProductStore((s) => s.toggleDisponibilidad);
  const deleteProducto = useProductStore((s) => s.deleteProducto);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const activos = productos
    .filter((p) => p.activo)
    .sort((a, b) => a.categoriaNombre.localeCompare(b.categoriaNombre) || a.orden - b.orden);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(producto: Producto) {
    setEditing(producto);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Productos"
        subtitle="Catálogo del menú"
        actions={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Nuevo producto
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {status === "loading" && productos.length === 0 && (
          <p className="py-10 text-center text-[13px] text-fg-muted">Cargando catálogo…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<Package size={26} weight="duotone" />}
            title="No se pudo cargar el catálogo"
            description={error ?? "Ocurrió un error inesperado."}
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        )}

        {status === "ready" && activos.length === 0 && (
          <EmptyState
            icon={<Package size={26} weight="duotone" />}
            title="Todavía no hay productos"
            description="Agrega el primer producto para poder armar comandas."
            action={
              <Button variant="secondary" size="sm" onClick={openCreate}>
                <Plus size={14} /> Nuevo producto
              </Button>
            }
          />
        )}

        {activos.length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-hover text-[11px] uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Producto</th>
                  <th className="px-4 py-2.5 font-medium">Categoría</th>
                  <th className="px-4 py-2.5 font-medium">Precio</th>
                  <th className="px-4 py-2.5 font-medium">Disponible</th>
                  <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {activos.map((producto) => (
                  <tr key={producto.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumbnail imagenUrl={producto.imagenUrl} alt={producto.nombre} />
                        <span className="font-medium text-fg">{producto.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{producto.categoriaNombre}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-fg-muted">
                      <DualPrice usd={producto.precio} />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={producto.disponible}
                        onChange={() => void toggleDisponibilidad(producto.id, !producto.disponible)}
                        label={`Disponibilidad de ${producto.nombre}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconButton
                          icon={<PencilSimple size={15} />}
                          label={`Editar ${producto.nombre}`}
                          size="sm"
                          onClick={() => openEdit(producto)}
                        />
                        <IconButton
                          icon={<Trash size={15} />}
                          label={`Quitar ${producto.nombre} del menú`}
                          variant="danger"
                          size="sm"
                          onClick={() => void deleteProducto(producto.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} producto={editing} />
    </div>
  );
}
