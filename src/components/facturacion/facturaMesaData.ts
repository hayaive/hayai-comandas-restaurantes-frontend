import type { Cobro } from "@/api";
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
 */

/**
 * Dos campos que el ticket necesita y el backend NO expone hoy (no hay
 * `GET /restaurante` en `CONTRACT.md`; `Restaurante.nombre`/`rif` existen en el
 * esquema pero ningún endpoint los devuelve). Se toman de la config del
 * frontend en vez de inventar un endpoint: cuando el backend lo exponga, este
 * default se reemplaza por la llamada real y nada más cambia.
 */
const RESTAURANTE_NOMBRE = import.meta.env.VITE_RESTAURANTE_NOMBRE ?? "Coffee & Cake";
const RESTAURANTE_RIF = import.meta.env.VITE_RESTAURANTE_RIF ?? null;

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
    restauranteNombre: RESTAURANTE_NOMBRE,
    restauranteRif: RESTAURANTE_RIF,
  };
}
