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

export function ProductFormModal({ open, onClose, producto }: ProductFormModalProps) {
  const categorias = useProductStore((s) => s.categorias);
  const createProducto = useProductStore((s) => s.createProducto);
  const updateProducto = useProductStore((s) => s.updateProducto);

  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [precio, setPrecio] = useState("");
  const [destino, setDestino] = useState<DestinoPreparacion>("cocina");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(producto?.nombre ?? "");
    setCategoriaId(producto?.categoriaId ?? categorias[0]?.id ?? "");
    setPrecio(producto?.precio ?? "");
    setDestino(producto?.destino ?? "cocina");
    setError(null);
  }, [open, producto, categorias]);

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
      if (producto) {
        await updateProducto(producto.id, { nombre: nombre.trim(), categoriaId, precio, destino });
      } else {
        await createProducto({ nombre: nombre.trim(), categoriaId, precio, destino });
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
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
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
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
        >
          {categorias.length === 0 && <option value="">Sin categorías</option>}
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </Select>
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
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
