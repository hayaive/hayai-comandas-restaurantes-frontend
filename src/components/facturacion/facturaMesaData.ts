import type { Cobro } from "@/api";
import { useRestauranteStore } from "@/lib/useRestauranteStore";
import type { FacturaMesaData } from "./FacturaMesaTicket";

/**
 * EL punto de adaptación entre el backend real y `FacturaMesaTicket`.
 *
 * `FacturaMesaTicket` se construyó antes de que existiera el endpoint de cobro
 * consolidado, y su propio encabezado lo dice: "cuando el endpoint real quede
 * definido, la adaptación es un mapeo hacia esta interfaz en un solo lugar, no
 * un rediseño del componente". Este archivo es ese lugar — el componente no se
 * tocó.
 *
 * El mapeo cuadra casi campo a campo porque `Cobro` es justo la entidad que el
 * ticket asumía: los consolidados (`subtotal`, `descuento`, `impuesto`,
 * `propina`, `total`, `totalBs`, `tasaValor`) ya vienen calculados y
 * congelados por el servidor, y `cobro.comandas` son las comandas que cubre.
 * Aquí no se suma ni una cifra.
 *
 * `restauranteNombre`/`restauranteRif`/`mostrarPreciosEn` salen ahora de
 * `useRestauranteStore` (`GET /restaurante`, cargado una vez en `AppShell`) en
 * vez de la variable de entorno `VITE_RESTAURANTE_NOMBRE` que se usaba antes
 * de que este endpoint existiera. `getState()` en vez del hook porque esta
 * función corre fuera de un componente React (se llama desde el handler que
 * abre `FacturaMesaModal`, no durante un render) — mismo patrón que usa
 * `shareCard.ts` para leer el logo configurado.
 */

export interface FacturaMesaContexto {
  /** Etiqueta de la mesa. `cobro.mesa` sólo viene en `GET /cobros/:id`. */
  mesaEtiqueta?: string | null;
  /**
   * Nombre del cliente. NO es un campo de `Cobro` ni de `Comanda`: lo aporta la
   * pantalla desde la reserva sentada (`v_mesa_estado.sentadaCliente`) cuando
   * la hay. Sin reserva, el ticket imprime "Consumidor final".
   */
  clienteNombre?: string | null;
}

export function cobroAFacturaMesa(
  cobro: Cobro,
  contexto: FacturaMesaContexto = {},
): FacturaMesaData {
  const restaurante = useRestauranteStore.getState().restaurante;
  return {
    mesaEtiqueta: contexto.mesaEtiqueta ?? cobro.mesa?.etiqueta ?? "—",
    clienteNombre: contexto.clienteNombre ?? null,
    comensales: cobro.comensales,
    comandas: cobro.comandas.map((comanda) => ({
      id: comanda.id,
      numeroDia: comanda.numeroDia,
      // El ticket llama `abiertaEn` a "cuándo se pidió esto": en el modelo
      // nuevo eso es `creadaEn` (una comanda nace con sus líneas, no se abre
      // vacía y se cierra después).
      abiertaEn: comanda.creadaEn,
      items: comanda.items
        // Las líneas anuladas no se imprimen en la factura: no se cobraron, y
        // `comanda.total` tampoco las cuenta. La traza de la anulación vive en
        // la base, no en el recibo del cliente.
        .filter((item) => item.canceladoEn == null)
        .map((item) => ({
          id: item.id,
          nombreSnap: item.nombreSnap,
          cantidad: item.cantidad,
          precioUnitarioSnap: item.precioUnitarioSnap,
          totalLinea: item.totalLinea,
          nota: item.nota,
        })),
      // Una comanda sólo tiene su total de líneas vivas: descuento, impuesto y
      // propina se negocian sobre la cuenta de la mesa y viven en el `Cobro`,
      // así que por comanda van en null y no en cero fabricado.
      subtotal: comanda.total,
      descuento: null,
      impuesto: null,
      propina: null,
      total: comanda.total,
    })),
    subtotal: cobro.subtotal,
    descuento: cobro.descuento,
    impuesto: cobro.impuesto,
    propina: cobro.propina,
    total: cobro.total,
    totalBs: cobro.totalBs,
    tasaValor: cobro.tasaValor,
    cerradaEn: cobro.cobradoEn,
    // Fallback "Coffee & Cake" sólo por si el ticket se imprime en el
    // instante entre que la app arranca y `GET /restaurante` responde (la
    // ventana en la que `useRestauranteBootstrap` ya está cargando pero el
    // store sigue en `null`) — nunca debería salir en un ticket real, cobrar
    // exige haber navegado la app ya con el store cargado.
    restauranteNombre: restaurante?.nombre ?? "Coffee & Cake",
    restauranteRif: restaurante?.rif ?? null,
    mostrarPreciosEn: restaurante?.mostrarPreciosEn ?? "ambas",
  };
}
