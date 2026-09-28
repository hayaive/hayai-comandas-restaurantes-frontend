/**
 * Impresión directa a una térmica ESC/POS por Web Serial (Chrome/Edge de
 * escritorio), sin diálogo de impresión.
 *
 * Una térmica emparejada por Bluetooth en Windows expone un puerto COM
 * virtual (SPP). La primera vez el navegador pide elegir el puerto —hay que
 * elegir el "saliente"—; después `getPorts()` lo devuelve ya autorizado y se
 * imprime directo.
 */

// Web Serial no viene en lib.dom de TS: sólo lo que se usa aquí.
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
}

function serial(): SerialLike | null {
  return (navigator as Navigator & { serial?: SerialLike }).serial ?? null;
}

export const serialDisponible = (): boolean => serial() != null;

/** Calibración por impresora: el SPP ignora el baud, pero algunas por cable no. */
const BAUD_RATE = 9600;

/**
 * `requestPort()` sólo funciona dentro de un gesto del usuario (el click de
 * "Imprimir"), así que esto tiene que llamarse directo desde el handler.
 */
export async function imprimirSerial(bytes: Uint8Array): Promise<void> {
  const api = serial();
  if (!api) throw new Error("Este navegador no soporta Web Serial");
  const [autorizado] = await api.getPorts();
  const port = autorizado ?? (await api.requestPort());
  await port.open({ baudRate: BAUD_RATE });
  try {
    const writer = port.writable!.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}

/* ---------------------------- Construcción ESC/POS --------------------------- */

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Página de códigos: `ESC t 2` = PC850 en la mayoría de térmicas genéricas.
 * Si salen símbolos raros en vez de acentos, este número es la perilla.
 */
const CODEPAGE = 2;
const CP850: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, ü: 0x81,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9, Ñ: 0xa5, Ü: 0x9a,
  "¡": 0xad, "¿": 0xa8, "·": 0xfa,
};

function encode(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.replace(/[\u00a0\u202f]/g, " ")) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) out.push(code);
    else if (ch in CP850) out.push(CP850[ch]);
    else {
      const base = ch.normalize("NFD").charCodeAt(0);
      out.push(base < 0x80 ? base : 0x3f); // "?"
    }
  }
  return out;
}

/** Arma un ticket línea por línea. `cols`: 32 para 58mm, 48 para 80mm (Font A). */
export class Ticket {
  private buf: number[] = [ESC, 0x40, ESC, 0x74, CODEPAGE];
  constructor(readonly cols: number) {}

  text(s: string): this {
    this.buf.push(...encode(s), 0x0a);
    return this;
  }
  bold(on: boolean): this {
    this.buf.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }
  align(a: "left" | "center" | "right"): this {
    this.buf.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
    return this;
  }
  /** Doble alto: resalta sin perder columnas. */
  tall(on: boolean): this {
    this.buf.push(GS, 0x21, on ? 0x01 : 0x00);
    return this;
  }
  sep(ch = "-"): this {
    return this.text(ch.repeat(this.cols));
  }
  /** Izquierda y derecha en una línea; si no caben, la derecha baja alineada. */
  row(l: string, r: string): this {
    const gap = this.cols - l.length - r.length;
    if (gap >= 1) return this.text(l + " ".repeat(gap) + r);
    return this.text(l).text(r.padStart(this.cols));
  }
  /** Avanza papel y corta (las que no tienen cuchilla ignoran el corte). */
  bytes(): Uint8Array {
    this.buf.push(ESC, 0x64, 4, GS, 0x56, 0x01);
    return Uint8Array.from(this.buf);
  }
}
