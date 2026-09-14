import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ProductThumbnail } from "@/components/productos/ProductThumbnail";
import { useProductStore } from "@/lib/useProductStore";
import { api, ApiError } from "@/api";
import type { DestinoPreparacion, Producto } from "@/api";

const TIPOS_IMAGEN_ACEPTADOS = "image/jpeg,image/png,image/webp";

/**
 * `imagenUrl` already loaded is treated as "pasted externally" (and the
 * advanced URL field opens by default) when it isn't something our own
 * upload endpoint produced — i.e. not `/uploads/...` and not a local
 * `blob:` preview URL from the mock client.
 */
function isExternalImagenUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !url.includes("/uploads/");
}

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
  const [imagenUploading, setImagenUploading] = useState(false);
  const [imagenError, setImagenError] = useState<string | null>(null);
  const [showImagenUrlField, setShowImagenUrlField] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCategoriaOpen, setNewCategoriaOpen] = useState(false);
  const [newCategoriaNombre, setNewCategoriaNombre] = useState("");
  const [newCategoriaSubmitting, setNewCategoriaSubmitting] = useState(false);
  const [newCategoriaError, setNewCategoriaError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initialImagenUrl = producto?.imagenUrl ?? "";
    setNombre(producto?.nombre ?? "");
    setCategoriaId(producto?.categoriaId ?? categorias[0]?.id ?? "");
    setPrecio(producto?.precio ?? "");
    setDestino(producto?.destino ?? "cocina");
    setImagenUrl(initialImagenUrl);
    setImagenUploading(false);
    setImagenError(null);
    setShowImagenUrlField(isExternalImagenUrl(initialImagenUrl));
    setError(null);
    setNewCategoriaOpen(false);
    setNewCategoriaNombre("");
    setNewCategoriaError(null);
  }, [open, producto, categorias]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires `onChange`.
    e.target.value = "";
    if (!file) return;
    setImagenError(null);
    setImagenUploading(true);
    try {
      const { url } = await api.uploadProductoImagen(file);
      setImagenUrl(url);
    } catch (err) {
      setImagenError(err instanceof ApiError ? err.message : "No se pudo subir la imagen");
    } finally {
      setImagenUploading(false);
    }
  }

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
    if (imagenUploading) {
      setError("Espera a que termine de subirse la imagen");
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
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={submitting || imagenUploading}
          >
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
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-fg">Foto del producto (opcional)</span>
          <div className="flex items-center gap-3">
            <ProductThumbnail imagenUrl={imagenUrl || undefined} alt={nombre || "Producto"} size="lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imagenUploading}
                >
                  {imagenUploading ? "Subiendo…" : imagenUrl ? "Cambiar foto" : "Elegir foto"}
                </Button>
                {imagenUrl && !imagenUploading && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImagenUrl("")}>
                    Quitar
                  </Button>
                )}
                <button
                  type="button"
                  className="text-[12px] text-fg-subtle underline underline-offset-2 hover:text-fg"
                  onClick={() => setShowImagenUrlField((v) => !v)}
                >
                  {showImagenUrlField ? "Ocultar URL manual" : "Pegar una URL en su lugar"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={TIPOS_IMAGEN_ACEPTADOS}
                className="hidden"
                onChange={(e) => void handleFileSelected(e)}
              />
              <p className="text-[12px] text-fg-subtle">JPG, PNG o WEBP, hasta 5MB.</p>
              {imagenError && <p className="text-[12px] text-danger">{imagenError}</p>}
            </div>
          </div>
          {showImagenUrlField && (
            <Input
              label="URL de imagen"
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
              placeholder="https://…"
            />
          )}
        </div>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
