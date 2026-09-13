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

export const useProductStore = create<ProductState>((set, get) => ({
  categorias: [],
  productos: [],
  status: "idle",
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const [categorias, productos] = await Promise.all([api.listCategorias(), api.listProductos()]);
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
    set({ productos: [...get().productos, producto] });
  },

  updateProducto: async (id, input) => {
    const updated = await api.updateProducto(id, input);
    set({ productos: get().productos.map((p) => (p.id === id ? updated : p)) });
  },

  toggleDisponibilidad: async (id, disponible) => {
    const updated = await api.setProductoDisponibilidad(id, disponible);
    set({ productos: get().productos.map((p) => (p.id === id ? updated : p)) });
  },

  deleteProducto: async (id) => {
    await api.deleteProducto(id);
    set({ productos: get().productos.map((p) => (p.id === id ? { ...p, activo: false } : p)) });
  },
}));

export function useActiveProducts(): Producto[] {
  return useProductStore((state) => state.productos.filter((p) => p.activo));
}
