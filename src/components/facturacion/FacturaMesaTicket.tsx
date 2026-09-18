import { Coffee } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatPrecioCobro,
  formatTasaValor,
  formatTime,
  formatUsd,
} from "@/lib/format";
import type { MostrarPreciosEn } from "@/api";

/**
 * Factura/recibo de cobro de una mesa — pensado para imprimirse en una
 * impresora térmica 58mm/80mm vía el diálogo de impresión del navegador
 * (`window.print()`), igual que hace `karelys-pedidos/src/components/ticket.tsx`
 * en el repo hermano. Ese componente se leyó sólo como referencia de LENGUAJE
 * VISUAL (ticket monoespaciado blanco y negro, logo arriba, separadores
 * punteados, footer) — nada de su lógica de negocio ni su shape de datos se
 * copió, porque pertenece a otro modelo de datos (`Order`/`Sale` de un solo
 * cobro). Ver `FacturaMesaModal.tsx` para el porqué de renderizar esto dos
 * veces (preview en pantalla + copia oculta en un portal para imprimir).
 *
 * ------------------------------------------------------------------------
 * CONTRATO DE DATOS — pensado para D.A.N.I, no adivinado
 * ------------------------------------------------------------------------
 * El backend está rediseñando en paralelo cómo una mesa puede acumular VARIAS
 * comandas antes de cobrarse (hoy el contrato en `src/api/types.ts` sigue
 * siendo 1 comanda = 1 cobro). En vez de bloquear este componente esperando
 * ese diseño, `FacturaMesaData` se construyó ÚNICAMENTE con campos que ya
 * existen hoy:
 *
 *   - `Comanda` (schema.prisma): subtotal, descuento, impuesto, propina,
 *     total, totalBs, tasaValor.
 *   - `ComandaItem` (schema.prisma): nombreSnap, cantidad, precioUnitarioSnap,
 *     totalLinea, nota.
 *   - `Restaurante` (schema.prisma): nombre, rif.
 *   - Los campos de mesa/cliente/comensales/cerradaEn ya existen tal cual en
 *     el `Comanda` del frontend (`src/api/types.ts`).
 *
 * `FacturaMesaData.comandas` agrupa varias comandas de la misma mesa bajo un
 * solo cobro; `FacturaMesaData.{subtotal,descuento,impuesto,propina,total,
 * totalBs,tasaValor}` son los CONSOLIDADOS de todas ellas — este componente
 * nunca los recalcula, sólo los imprime.
 *
 * La única aritmética que sí hace es la conversión a bolívares de cada línea
 * y de los subtotales, y es inevitable: el backend congela el cobro en Bs
 * únicamente a nivel de `totalBs`, no por línea. Se usa `tasaValor` —la tasa
 * congelada de ESE cobro, no la vigente— así que es determinista y reimprimir
 * una factura vieja da las mismas cifras. El TOTAL nunca se convierte aquí:
 * sale de `totalBs`, que es el que quedó registrado. Cuando el endpoint real de cobro consolidado
 * quede definido, la adaptación es un mapeo hacia esta interfaz en un solo
 * lugar, no un rediseño del componente.
 *
 * No se inventaron campos que no existen en ninguno de los dos modelos (sin
 * NIT/dirección/teléfono — `Restaurante` no los tiene hoy). `mensajeFooter`
 * es la única excepción: un texto libre *opcional* con un default de UX, no
 * un campo del backend.
 *
 * ------------------------------------------------------------------------
 * `mostrarPreciosEn` (Configuración) — SIGUE usando `tasaValor`, nunca la
 * vigente
 * ------------------------------------------------------------------------
 * La pantalla de Configuración agregó `Restaurante.mostrarPreciosEn`
 * ("usd" | "bs" | "ambas"): en qué moneda se DIBUJA cada línea. Eso es
 * ortogonal a lo de arriba — decide SI se imprime el equivalente en
 * bolívares, no CON QUÉ TASA. La tasa sigue siendo siempre `data.tasaValor`,
 * la congelada del cobro; este componente no importa `useTasaStore` ni lee
 * la tasa vigente en ningún punto, a propósito. Ver `formatPrecioCobro` en
 * `src/lib/format.ts` — es la función gemela de `formatPrecioVivo` (la que sí
 * usa la vigente, para cuentas sin cobrar), y existen como dos funciones
 * separadas precisamente para que este componente no pueda mezclar las dos
 * tasas por accidente.
 */

export interface FacturaMesaItem {
  id: string;
  /** Snapshot del nombre al momento de ordenar — nunca el nombre live del producto. */
  nombreSnap: string;
  /** `ComandaItem.cantidad` es `Decimal(14,3)` en el backend; el contrato
   * actual del frontend lo trae como `number` — se acepta cualquiera de los
   * dos para no forzar una conversión en el call site. */
  cantidad: string | number;
  precioUnitarioSnap: string;
  totalLinea: string;
  nota?: string | null;
}

export interface FacturaMesaComanda {
  id: string;
  /** Número visible del día ("Comanda #14"). `null`/`undefined` sólo en datos legacy. */
  numeroDia?: number | null;
  abiertaEn: string;
  meseroNombre?: string | null;
  items: FacturaMesaItem[];
  /** Totales de ESTA comanda sola — se muestran sólo cuando hay más de una
   * comanda en la mesa, como referencia; el total que manda es el consolidado. */
  subtotal: string;
  descuento?: string | null;
  impuesto?: string | null;
  propina?: string | null;
  total: string;
}

export interface FacturaMesaData {
  mesaEtiqueta: string;
  clienteNombre?: string | null;
  comensales?: number;
  /** Una o más comandas de la misma mesa, consolidadas en un solo cobro. */
  comandas: FacturaMesaComanda[];
  /** Consolidados de TODAS las comandas de arriba — ya calculados por el
   * backend, este componente no los recalcula. */
  subtotal: string;
  descuento?: string | null;
  impuesto?: string | null;
  propina?: string | null;
  total: string;
  /** Congelados al cobrar, igual que en `Comanda.totalBs`/`tasaValor`.
   * `null`/`undefined` cuando el restaurante todavía no tenía tasa del día. */
  totalBs?: string | null;
  tasaValor?: string | null;
  /** Cuándo se cerró/cobró la cuenta. Si falta, se imprime "ahora". */
  cerradaEn?: string | null;
  restauranteNombre: string;
  restauranteRif?: string | null;
  /**
   * `Restaurante.mostrarPreciosEn` — en qué moneda se imprime cada línea.
   * `undefined`/ausente cae a `"ambas"`, el comportamiento que el ticket ya
   * tenía antes de que existiera esta preferencia (así un caller viejo que
   * no la pase no cambia nada).
   */
  mostrarPreciosEn?: MostrarPreciosEn;
  /** Texto libre opcional para el pie. No es un campo del backend — default de UX. */
  mensajeFooter?: string;
}

export type FacturaPaperWidth = "58mm" | "80mm";

export interface FacturaMesaTicketProps {
  data: FacturaMesaData;
  paperWidth?: FacturaPaperWidth;
  /** Pásalo SÓLO en la copia que debe imprimirse (ver `FacturaMesaModal`) —
   * el preview en pantalla no necesita id porque no es el blanco de impresión. */
  id?: string;
  className?: string;
}

export function FacturaMesaTicket({
  data,
  paperWidth = "58mm",
  id,
  className,
}: FacturaMesaTicketProps) {
  const totalBsFmt = formatBsAmount(data.totalBs);
  const descuento = withValue(data.descuento);
  const impuesto = withValue(data.impuesto);
  const propina = withValue(data.propina);
  const variasComandas = data.comandas.length > 1;
  const vista = data.mostrarPreciosEn ?? "ambas";

  /**
   * Cada línea del ticket, en la vista de precios configurada
   * (`mostrarPreciosEn`). Usa `formatPrecioCobro` — no `formatPrecioVivo` —
   * porque la conversión aquí SIEMPRE va con `data.tasaValor`, la tasa
   * CONGELADA en el cobro, no la vigente de hoy: reimprimir una factura vieja
   * tiene que dar exactamente las mismas cifras que el día que se cobró (ver
   * la nota grande en `src/lib/format.ts`). Sin tasa registrada ese día,
   * `formatPrecioCobro` ya degrada solo a USD en vez de repetir "tasa no
   * disponible" en cada renglón.
   */
  const money = (usd: string | number): string => formatPrecioCobro(usd, vista, data.tasaValor);

  /**
   * La fila de TOTAL es la única que NO pasa por `money()`: usa
   * `data.totalBs`, ya calculado y congelado por el backend al cobrar, en vez
   * de convertir `data.total` aquí (que podría quedar a un céntimo de
   * distancia por redondeo — ver el comentario junto a la fila más abajo).
   * Por eso necesita su propia versión de la degradación sin tasa, para
   * decidir si esa fila se imprime en Bs o cae a USD.
   */
  const vistaTotalEfectiva: MostrarPreciosEn =
    (vista === "bs" || vista === "ambas") && !data.tasaValor ? "usd" : vista;
  const totalPrincipal =
    vistaTotalEfectiva === "usd" ? formatUsd(data.total) : (totalBsFmt ?? formatUsd(data.total));
  // La referencia en dólares (y la nota de tasa) sólo se imprime en vista
  // "ambas": es justo la que promete mostrar las dos monedas. En "usd" no hay
  // bolívares que referenciar, y en "bs" el dueño pidió explícitamente sólo
  // bolívares — imprimir un monto en USD ahí, aunque sea "de referencia",
  // sería colar la moneda que pidió no mostrar.
  const mostrarReferenciaUsd = vistaTotalEfectiva === "ambas" && Boolean(data.tasaValor);

  return (
    <div
      id={id}
      data-paper-width={paperWidth}
      className={cn(
        "mx-auto bg-white p-3 text-[11px] leading-snug text-black",
        paperWidth === "80mm" ? "w-[80mm]" : "w-[58mm]",
        className,
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {/* Encabezado — logo en blanco y negro (public/logo-mono.png, derivado
          del sello real de public/logo.jpg, ver reporte de L.E.O.A.R.T). */}
      <div className="flex flex-col items-center text-center">
        <img
          src="/logo-mono.png"
          alt=""
          aria-hidden="true"
          className="mb-1.5 h-14 w-14 object-contain"
        />
        <p className="text-[14px] font-bold uppercase tracking-wide">
          {data.restauranteNombre}
        </p>
        {data.restauranteRif && <p className="text-[10px]">{data.restauranteRif}</p>}
      </div>

      <Sep />

      <p className="text-center text-[11px] font-bold uppercase">Factura de cobro</p>

      <div className="mt-1.5 flex flex-col gap-0.5">
        <Row l="Mesa" r={data.mesaEtiqueta} />
        <Row l="Cliente" r={data.clienteNombre ?? "Consumidor final"} />
        {data.comensales != null && <Row l="Comensales" r={String(data.comensales)} />}
        <Row l="Fecha" r={formatDateTime(data.cerradaEn ?? new Date().toISOString())} />
      </div>

      <Sep />

      {/* Detalle — una o más comandas de la misma mesa consolidadas en esta
          cuenta. Con una sola comanda no tiene sentido repetir su encabezado,
          así que sólo aparece cuando hay más de una. */}
      {data.comandas.map((comanda, index) => (
        <div key={comanda.id} className={index > 0 ? "mt-2" : undefined}>
          {variasComandas && (
            <div className="mb-1 flex items-baseline justify-between font-bold uppercase">
              <span>Comanda {comanda.numeroDia != null ? `#${comanda.numeroDia}` : ""}</span>
              <span className="font-normal normal-case text-black/70">
                {formatTime(comanda.abiertaEn)}
              </span>
            </div>
          )}
          {comanda.meseroNombre && (
            <p className="mb-1 text-[10px] normal-case text-black/70">
              Mesero: {comanda.meseroNombre}
            </p>
          )}
          {comanda.items.length === 0 ? (
            <p className="mb-1 text-[10px] italic text-black/60">Sin ítems.</p>
          ) : (
            comanda.items.map((item) => (
              <div key={item.id} className="mb-1">
                <p className="uppercase">{item.nombreSnap}</p>
                {item.nota && <p className="text-[10px]">* {item.nota}</p>}
                <div className="flex justify-between gap-2">
                  <span>
                    {formatCantidad(item.cantidad)} x {money(item.precioUnitarioSnap)}
                  </span>
                  <span className="tabular-nums">{money(item.totalLinea)}</span>
                </div>
              </div>
            ))
          )}
          {variasComandas && index < data.comandas.length - 1 && <SepLight />}
        </div>
      ))}

      <Sep />

      {/* Totales consolidados de TODAS las comandas de arriba. */}
      <div className="flex flex-col gap-0.5">
        <Row l="Subtotal" r={money(data.subtotal)} />
        {descuento && <Row l="Descuento" r={`-${money(descuento)}`} />}
        {impuesto && <Row l="Impuesto" r={money(impuesto)} />}
        {propina && <Row l="Propina" r={money(propina)} />}
      </div>

      <Sep />

      {/* El total que manda es `totalBs`: lo calculó y congeló el backend al
          cobrar. Convertir `total` aquí daría una cifra propia que podría
          diferir en céntimos de la que quedó registrada, y en el recibo del
          cliente manda la del cobro. Las líneas de arriba sí se convierten
          —el backend no las guarda en Bs— y por redondeo su suma puede
          quedar a un céntimo de este total. Con vista "usd" el principal es
          el dólar y no hay nada de esto que mostrar. */}
      <Row l="TOTAL" r={totalPrincipal} bold large />
      {mostrarReferenciaUsd && (
        <>
          {/* El menú está en dólares: la referencia deja auditar el ticket
              contra la carta sin llenar cada línea de dos monedas. */}
          <p className="text-right text-[10px] text-black/70 tabular-nums">
            ({formatUsd(data.total)})
          </p>
          <p className="mt-0.5 text-[10px] text-black/70">
            Tasa del día: {formatTasaValor(data.tasaValor)}
          </p>
        </>
      )}

      <Sep />

      <p className="py-1 text-center text-[11px] font-bold uppercase">
        {data.mensajeFooter ?? "¡Gracias por su visita!"}
      </p>

      <div className="mt-1 flex justify-center">
        <Coffee size={18} strokeWidth={1.75} aria-hidden="true" />
      </div>
    </div>
  );
}

/** `undefined`/`null`/"0" se tratan igual: la línea no se imprime. */
function withValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? value : null;
}

/** Ya viene calculado y congelado por el backend — sólo se formatea para imprimir. */
function formatBsAmount(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** `ComandaItem.cantidad` es `Decimal(14,3)` en el backend — hasta 3
 * decimales para ítems que se venden por peso, sin redondear de más. */
function formatCantidad(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

const Sep = () => <div className="my-1.5 border-t border-dashed border-black" />;
const SepLight = () => <div className="my-1 border-t border-dotted border-black/40" />;

function Row({
  l,
  r,
  bold,
  large,
}: {
  l: string;
  r: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2",
        bold && "font-bold",
        large && "text-[13px]",
      )}
    >
      <span>{l}</span>
      <span className="tabular-nums">{r}</span>
    </div>
  );
}
