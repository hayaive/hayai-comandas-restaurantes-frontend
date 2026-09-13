import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/api";
import type { ProductoVendido, ReporteDia } from "@/api";

interface SalesReportState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  totales: ReporteDia | null;
  /**
   * Productos más vendidos del día, ordenados por cantidad y con su ingreso al
   * lado. El contrato ofrece dos ordenamientos (`cantidad` e `ingreso`) porque
   * "el más vendido" tiene dos respuestas; la pantalla muestra una sola lista
   * con ambas cifras en vez de dos tablas que dicen cosas distintas.
   */
  productosVendidos: ProductoVendido[];
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

/** Hora de corte por defecto del restaurante (`restaurante.horaCorteDia`). */
const HORA_CORTE = 5;

/**
 * Día operativo actual, que NO es la fecha del calendario.
 *
 * El backend agrupa todo por `fechaOperativa`, calculada con la hora de corte
 * del restaurante: un pedido de la 1:00 a.m. del sábado pertenece al viernes.
 * Aquí sólo hay que decidir **qué fecha pedirle** al reporte, y el backend no
 * expone `horaCorteDia` ni la zona horaria por API, así que se asume el default
 * del contrato (05:00, hora local del navegador). Si un restaurante cambia su
 * corte, este cálculo hay que alimentarlo desde el backend.
 *
 * Se usa la fecha LOCAL a propósito: `toISOString()` da UTC y en Venezuela
 * (-04:00) mandaría el reporte al día siguiente a partir de las 20:00.
 */
export function todayIso(): string {
  const d = new Date();
  if (d.getHours() < HORA_CORTE) d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resumen de ventas del día para el dashboard: totales + productos más vendidos. */
export function useSalesReport() {
  const [state, setState] = useState<SalesReportState>({
    status: "idle",
    error: null,
    totales: null,
    productosVendidos: [],
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const fecha = todayIso();
      const [totales, porCantidad, porIngreso] = await Promise.all([
        api.getReporteDia(fecha),
        api.getReporteProductos("cantidad", 8, fecha),
        api.getReporteProductos("ingreso", 8, fecha),
      ]);
      // Se cruzan ambos ordenamientos para que cada fila lleve su ingreso real
      // aunque la consulta por cantidad no lo devuelva.
      const ingresoPorProducto = new Map(porIngreso.map((p) => [p.productoId, p.ingresoUsd]));
      const productosVendidos = porCantidad.map((p) => ({
        ...p,
        ingresoUsd: ingresoPorProducto.get(p.productoId) ?? p.ingresoUsd,
      }));
      setState({ status: "ready", error: null, totales, productosVendidos });
    } catch (error) {
      setState((s) => ({ ...s, status: "error", error: messageOf(error) }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
