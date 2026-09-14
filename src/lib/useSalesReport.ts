import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/api";
import type { PeriodoReporte, ProductoVendido, ReporteVentas } from "@/api";

interface SalesReportState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  reporte: ReporteVentas | null;
  /**
   * Productos más vendidos del día operativo actual, ordenados por cantidad y
   * con su ingreso al lado. El contrato ofrece dos ordenamientos (`cantidad` e
   * `ingreso`) porque "el más vendido" tiene dos respuestas; la pantalla
   * muestra una sola lista con ambas cifras en vez de dos tablas que dicen
   * cosas distintas. A diferencia del reporte de ventas, este ranking no se
   * filtra por período — el cliente sólo pidió el filtro para los totales.
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
 *
 * `GET /reportes/ventas` ya no necesita esto — resuelve el día operativo del
 * lado del backend (ver `useSalesReport` abajo) — pero `VentasPage` lo sigue
 * usando para pedir el histórico de comandas cobradas en la sesión, que no
 * tiene equivalente en ese endpoint.
 */
export function todayIso(): string {
  const d = new Date();
  if (d.getHours() < HORA_CORTE) d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Reporte de ventas del período elegido (día/mes/año) + productos más
 * vendidos del día operativo actual, para el dashboard de Ventas.
 */
export function useSalesReport(periodo: PeriodoReporte = "dia") {
  const [state, setState] = useState<SalesReportState>({
    status: "idle",
    error: null,
    reporte: null,
    productosVendidos: [],
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const reporte = await api.getReporteVentas(periodo);
      // `reporte.fecha` es el día operativo actual resuelto por el backend
      // (mismo valor sin importar el período pedido, ver CONTRACT): se
      // reusa aquí para no calcular "hoy" a mano contra `/reportes/productos`.
      const [porCantidad, porIngreso] = await Promise.all([
        api.getReporteProductos("cantidad", 8, reporte.fecha),
        api.getReporteProductos("ingreso", 8, reporte.fecha),
      ]);
      // Se cruzan ambos ordenamientos para que cada fila lleve su ingreso real
      // aunque la consulta por cantidad no lo devuelva.
      const ingresoPorProducto = new Map(porIngreso.map((p) => [p.productoId, p.ingresoUsd]));
      const productosVendidos = porCantidad.map((p) => ({
        ...p,
        ingresoUsd: ingresoPorProducto.get(p.productoId) ?? p.ingresoUsd,
      }));
      setState({ status: "ready", error: null, reporte, productosVendidos });
    } catch (error) {
      setState((s) => ({ ...s, status: "error", error: messageOf(error) }));
    }
  }, [periodo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
