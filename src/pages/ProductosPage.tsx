import { useEffect, useMemo, useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Switch } from "@/components/ui/Switch";
import { PageBody, Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProductStore } from "@/lib/useProductStore";
import { ProductFormModal } from "@/components/productos/ProductFormModal";
import { ProductThumbnail } from "@/components/productos/ProductThumbnail";
import { DualPrice } from "@/components/shared/DualPrice";
import { cn } from "@/lib/cn";
import type { Producto } from "@/api";

/** `null` = "Todas": the catalogue is unfiltered. */
type CategoriaFiltro = string | null;

export function ProductosPage() {
  const status = useProductStore((s) => s.status);
  const error = useProductStore((s) => s.error);
  const productos = useProductStore((s) => s.productos);
  const load = useProductStore((s) => s.load);
  const toggleDisponibilidad = useProductStore((s) => s.toggleDisponibilidad);
  const deleteProducto = useProductStore((s) => s.deleteProducto);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [categoria, setCategoria] = useState<CategoriaFiltro>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const activos = useMemo(
    () =>
      productos
        .filter((p) => p.activo)
        .sort(
          (a, b) =>
            a.categoriaNombre.localeCompare(b.categoriaNombre) || a.orden - b.orden,
        ),
    [productos],
  );

  /** Categorías presentes en el catálogo activo, para la fila de filtros. */
  const categorias = useMemo(
    () => [...new Set(activos.map((p) => p.categoriaNombre))].sort(),
    [activos],
  );

  const visibles = useMemo(
    () => (categoria === null ? activos : activos.filter((p) => p.categoriaNombre === categoria)),
    [activos, categoria],
  );

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

      <PageBody>
        {status === "loading" && productos.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">Cargando catálogo…</p>
        )}

        {status === "error" && (
          <EmptyState
            icon={<Package size={26} />}
            title="No se pudo cargar el catálogo"
            description={error ?? "Ocurrió un error inesperado."}
            action={<Button onClick={() => void load()}>Reintentar</Button>}
          />
        )}

        {status === "ready" && activos.length === 0 && (
          <EmptyState
            icon={<Package size={26} />}
            title="Todavía no hay productos"
            description="Agrega el primer producto para poder armar comandas."
            action={
              <Button variant="primary" onClick={openCreate}>
                <Plus size={14} /> Nuevo producto
              </Button>
            }
          />
        )}

        {activos.length > 0 && (
          <Section
            title="Todos los productos"
            description={
              categoria === null
                ? undefined
                : `Mostrando sólo ${categoria}. ${visibles.length} de ${activos.length}.`
            }
          >
            {/* Fila de filtros por categoría, tomada del patrón del template.
                El filtro activo es MARRÓN con texto blanco (override del
                cliente); los demás son chips outline neutros. */}
            {categorias.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <FiltroChip
                  active={categoria === null}
                  onClick={() => setCategoria(null)}
                  label="Todas"
                  count={activos.length}
                />
                {categorias.map((nombre) => (
                  <FiltroChip
                    key={nombre}
                    active={categoria === nombre}
                    onClick={() => setCategoria(nombre)}
                    label={nombre}
                    count={activos.filter((p) => p.categoriaNombre === nombre).length}
                  />
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
              {/* La tabla desborda horizontalmente en su propio contenedor, no
                  en el body de la página: a ~400px las cinco columnas no caben
                  y forzarlas rompería el gutter lateral del layout. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border bg-surface-sunken text-[11px] uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th className="px-5 py-3 font-medium">Producto</th>
                      <th className="px-5 py-3 font-medium">Categoría</th>
                      <th className="px-5 py-3 font-medium">Precio</th>
                      <th className="px-5 py-3 font-medium">Disponible</th>
                      <th className="px-5 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibles.map((producto) => (
                      <tr
                        key={producto.id}
                        className="transition-colors duration-150 hover:bg-surface-hover"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <ProductThumbnail imagenUrl={producto.imagenUrl} alt={producto.nombre} />
                            <span className="font-medium text-fg">{producto.nombre}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone="neutral">{producto.categoriaNombre}</Badge>
                        </td>
                        <td className="px-5 py-3 font-mono tabular-nums text-fg-muted">
                          <DualPrice usd={producto.precio} />
                        </td>
                        <td className="px-5 py-3">
                          <Switch
                            checked={producto.disponible}
                            onChange={() =>
                              void toggleDisponibilidad(producto.id, !producto.disponible)
                            }
                            label={`Disponibilidad de ${producto.nombre}`}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconButton
                              icon={<Pencil size={15} />}
                              label={`Editar ${producto.nombre}`}
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(producto)}
                            />
                            <IconButton
                              icon={<Trash2 size={15} />}
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
            </div>
          </Section>
        )}
      </PageBody>

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} producto={editing} />
    </div>
  );
}

/**
 * Un chip de filtro. Activo = marrón/blanco, por el override del cliente; el
 * conteo va en una cápsula translúcida dentro del propio chip para que no
 * compita con la etiqueta.
 */
function FiltroChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3.5 py-2 text-[13px] font-medium",
        "transition-colors duration-150",
        active
          ? "border-transparent bg-active text-active-fg"
          : "border-input bg-surface-raised text-fg-muted hover:border-border-strong hover:bg-surface-hover hover:text-fg",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[11px] tabular-nums leading-none",
          active ? "bg-white/20 text-active-fg" : "bg-surface-hover text-fg-subtle",
        )}
      >
        {count}
      </span>
    </button>
  );
}
