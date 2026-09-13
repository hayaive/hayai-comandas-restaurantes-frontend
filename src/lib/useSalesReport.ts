import { useEffect, useState } from "react";
import { api, ApiError } from "@/api";
import type { ProductoVendido, ReporteDia } from "@/api";

interface SalesReportState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  totales: ReporteDia | null;
  masVendidoPorCantidad: ProductoVendido[];
  masVendidoPorIngreso: ProductoVendido[];
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Today's sales summary for the Ventas dashboard: totals + top product by qty and by revenue. */
export function useSalesReport() {
  const [state, setState] = useState<SalesReportState>({
    status: "idle",
    error: null,
    totales: null,
    masVendidoPorCantidad: [],
    masVendidoPorIngreso: [],
  });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setState((s) => ({ ...s, status: "loading", error: null }));
      try {
        const fecha = todayIso();
        const [totales, porCantidad, porIngreso] = await Promise.all([
          api.getReporteDia(fecha),
          api.getReporteProductos("cantidad", 5),
          api.getReporteProductos("ingreso", 5),
        ]);
        if (cancelled) return;
        setState({
          status: "ready",
          error: null,
          totales,
          masVendidoPorCantidad: porCantidad,
          masVendidoPorIngreso: porIngreso,
        });
      } catch (error) {
        if (cancelled) return;
        setState((s) => ({ ...s, status: "error", error: messageOf(error) }));
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
