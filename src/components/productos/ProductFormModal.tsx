import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useProductStore } from "@/lib/useProductStore";
import { ApiError } from "@/api";
import type { DestinoPreparacion, Producto } from "@/api";

export interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal edits this product instead of creating a new one. */
  producto?: Producto | null;
}

const DESTINOS: { value: DestinoPreparacion; label: string }[] = [
  { value: "cocina", label: "Cocina" },
  { value: "barra", label: "Barra" },
  { value: "ninguno", label: "Ninguno" },
];

/** Sentinel `<option>` value that opens the inline "new category" panel instead of selecting one. */
const NEW_CATEGORIA_VALUE = "__nueva_categoria__";

export function ProductFormModal({ open, onClose, producto }: ProductFormModalProps) {
  const categorias = useProductStore((s) => s.categorias);
  const createCategoria = useProductStore((s) => s.createCategoria);
  const createProducto = useProductStore((s) => s.createProducto);
  const updateProducto = useProductStore((s) => s.updateProducto);

  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [precio, setPrecio] = useState("");
  const [destino, setDestino] = useState<DestinoPreparacion>("cocina");
  const [imagenUrl, setImagenUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCategoriaOpen, setNewCategoriaOpen] = useState(false);
  const [newCategoriaNombre, setNewCategoriaNombre] = useState("");
  const [newCategoriaSubmitting, setNewCategoriaSubmitting] = useState(false);
  const [newCategoriaError, setNewCategoriaError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(producto?.nombre ?? "");
    setCategoriaId(producto?.categoriaId ?? categorias[0]?.id ?? "");
    setPrecio(producto?.precio ?? "");
    setDestino(producto?.destino ?? "cocina");
    setImagenUrl(producto?.imagenUrl ?? "");
    setError(null);
    setNewCategoriaOpen(false);
    setNewCategoriaNombre("");
    setNewCategoriaError(null);
  }, [open, producto, categorias]);

  function handleCategoriaChange(value: string) {
    if (value === NEW_CATEGORIA_VALUE) {
      setNewCategoriaOpen(true);
      setNewCategoriaNombre("");
      setNewCategoriaError(null);
      return;
    }
    setCategoriaId(value);
  }

  async function handleCreateCategoria() {
    const trimmed = newCategoriaNombre.trim();
    if (!trimmed) {
      setNewCategoriaError("El nombre de la categoría es obligatorio");
      return;
    }
    setNewCategoriaSubmitting(true);
    setNewCategoriaError(null);
    try {
      await createCategoria(trimmed);
      const cats = useProductStore.getState().categorias;
      const created = [...cats].reverse().find((c) => c.nombre === trimmed) ?? cats[cats.length - 1];
      if (created) setCategoriaId(created.id);
      setNewCategoriaOpen(false);
      setNewCategoriaNombre("");
    } catch (err) {
      setNewCategoriaError(err instanceof ApiError ? err.message : "No se pudo crear la categoría");
    } finally {
      setNewCategoriaSubmitting(false);
    }
  }

  function handleCancelNewCategoria() {
    setNewCategoriaOpen(false);
    setNewCategoriaNombre("");
    setNewCategoriaError(null);
  }

  async function handleSubmit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!categoriaId) {
      setError("Selecciona una categoría");
      return;
    }
    const precioNum = Number(precio);
    if (!Number.isFinite(precioNum) || precioNum <= 0) {
      setError("El precio debe ser un número mayor a cero");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const imagenUrlTrimmed = imagenUrl.trim() || undefined;
      if (producto) {
        await updateProducto(producto.id, {
          nombre: nombre.trim(),
          categoriaId,
          precio,
          destino,
          imagenUrl: imagenUrlTrimmed,
        });
      } else {
        await createProducto({
          nombre: nombre.trim(),
          categoriaId,
          precio,
          destino,
          imagenUrl: imagenUrlTrimmed,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el producto");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={producto ? "Editar producto" : "Nuevo producto"}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Pabellón criollo"
          autoFocus
        />
        <Select
          label="Categoría"
          value={newCategoriaOpen ? NEW_CATEGORIA_VALUE : categoriaId}
          onChange={(e) => handleCategoriaChange(e.target.value)}
        >
          {categorias.length === 0 && <option value="">Sin categorías</option>}
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
          <option value={NEW_CATEGORIA_VALUE}>+ Nueva categoría…</option>
        </Select>

        {newCategoriaOpen && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-dashed border-border p-3.5">
            <div className="flex items-end gap-2">
              <Input
                label="Nueva categoría"
                value={newCategoriaNombre}
                onChange={(e) => setNewCategoriaNombre(e.target.value)}
                placeholder="Ej. Postres"
                fieldClassName="flex-1"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => void handleCreateCategoria()}
                disabled={newCategoriaSubmitting}
              >
                {newCategoriaSubmitting ? "Creando…" : "Crear"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelNewCategoria} disabled={newCategoriaSubmitting}>
                Cancelar
              </Button>
            </div>
            {newCategoriaError && <p className="text-[12px] text-danger">{newCategoriaError}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio (USD)"
            type="number"
            min={0}
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0.00"
          />
          <Select
            label="Destino de preparación"
            value={destino}
            onChange={(e) => setDestino(e.target.value as DestinoPreparacion)}
          >
            {DESTINOS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="URL de imagen (opcional)"
          value={imagenUrl}
          onChange={(e) => setImagenUrl(e.target.value)}
          placeholder="https://…"
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
