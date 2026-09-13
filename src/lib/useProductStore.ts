import { useMemo } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api";
import type { Categoria, CreateProductoInput, Producto, UpdateProductoInput } from "@/api";

interface ProductState {
  categorias: Categoria[];
  productos: Producto[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  load: () => Promise<void>;
  createCategoria: (nombre: string) => Promise<void>;
  createProducto: (input: CreateProductoInput) => Promise<void>;
  updateProducto: (id: string, input: UpdateProductoInput) => Promise<void>;
  toggleDisponibilidad: (id: string, disponible: boolean) => Promise<void>;
  deleteProducto: (id: string) => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

/**
 * El backend real no denormaliza `categoriaNombre` en `/productos` (sólo
 * manda `categoriaId`) — el tipo `Producto` lo espera porque el mock sí lo
 * traía a mano. Sin este join, `categoriaNombre` llega `undefined` y
 * `.localeCompare()` en ProductosPage revienta la pantalla completa.
 */
function conCategoriaNombre(producto: Producto, categorias: Categoria[]): Producto {
  if (producto.categoriaNombre) return producto;
  const categoria = categorias.find((c) => c.id === producto.categoriaId);
  return { ...producto, categoriaNombre: categoria?.nombre ?? "Sin categoría" };
}

export const useProductStore = create<ProductState>((set, get) => ({
  categorias: [],
  productos: [],
  status: "idle",
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const [categorias, productosCrudos] = await Promise.all([api.listCategorias(), api.listProductos()]);
      const productos = productosCrudos.map((p) => conCategoriaNombre(p, categorias));
      set({ categorias, productos, status: "ready" });
    } catch (error) {
      set({ status: "error", error: messageOf(error) });
    }
  },

  createCategoria: async (nombre) => {
    const categoria = await api.createCategoria(nombre);
    set({ categorias: [...get().categorias, categoria] });
  },

  createProducto: async (input) => {
    const producto = await api.createProducto(input);
    set({ productos: [...get().productos, conCategoriaNombre(producto, get().categorias)] });
  },

  updateProducto: async (id, input) => {
    const updated = await api.updateProducto(id, input);
    const enriched = conCategoriaNombre(updated, get().categorias);
    set({ productos: get().productos.map((p) => (p.id === id ? enriched : p)) });
  },

  toggleDisponibilidad: async (id, disponible) => {
    const updated = await api.setProductoDisponibilidad(id, disponible);
    const enriched = conCategoriaNombre(updated, get().categorias);
    set({ productos: get().productos.map((p) => (p.id === id ? enriched : p)) });
  },

  deleteProducto: async (id) => {
    await api.deleteProducto(id);
    set({ productos: get().productos.map((p) => (p.id === id ? { ...p, activo: false } : p)) });
  },
}));

export function useActiveProducts(): Producto[] {
  // Mismo cuidado que useTodaysReservations: seleccionar el arreglo crudo
  // (referencia estable) y memoizar el filtro, no devolver un arreglo nuevo
  // desde el selector de Zustand (ver commit del fix de Reservaciones).
  const productos = useProductStore((state) => state.productos);
  return useMemo(() => productos.filter((p) => p.activo), [productos]);
}
