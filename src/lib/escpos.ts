/**
 * Impresión directa a una térmica ESC/POS, sin diálogo de impresión.
 *
 * Dos transportes, según lo que exponga la impresora:
 *
 * - Web Serial (Chrome/Edge escritorio, Chrome Android 138+): Bluetooth
 *   clásico (SPP). En Windows la térmica emparejada es un puerto COM —hay
 *   que elegir el "saliente"—; después `getPorts()` lo devuelve ya
 *   autorizado y se imprime directo, incluso tras recargar.
 * - Web Bluetooth (Chrome Android sobre todo): térmicas portátiles BLE. En
 *   Android el selector de puerto serie NO las muestra aunque estén
 *   emparejadas, por eso ahí va primero BLE. El dispositivo elegido se
 *   recuerda mientras la app esté abierta.
 */

// Ni Web Serial ni Web Bluetooth vienen en lib.dom de TS: sólo lo que se usa aquí.
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
}
interface BleCharacteristic {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
}
interface BleService {
  getCharacteristics(): Promise<BleCharacteristic[]>;
}
interface BleDevice {
  gatt?: {
    connected: boolean;
    connect(): Promise<{ getPrimaryServices(): Promise<BleService[]> }>;
  };
}
interface BluetoothLike {
  requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BleDevice>;
  getDevices?(): Promise<BleDevice[]>;
}

const nav = navigator as Navigator & { serial?: SerialLike; bluetooth?: BluetoothLike };
const esAndroid = /Android/i.test(navigator.userAgent);

export const impresionDirectaDisponible = (): boolean => nav.serial != null || nav.bluetooth != null;

/**
 * Manda los bytes a la térmica. Un puerto serie ya autorizado gana siempre;
 * si no hay, Android prueba BLE y escritorio el selector de puerto serie.
 *
 * Los selectores sólo abren dentro de un gesto del usuario (el click de
 * "Imprimir"): llamar directo desde el handler, sin `await` antes. Si el
 * usuario cierra el selector sin elegir, rechaza con `NotFoundError`.
 */
export async function imprimirTermica(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const [autorizado] = (await nav.serial?.getPorts()) ?? [];
  if (autorizado) return escribirSerial(autorizado, bytes);
  if (nav.bluetooth && (esAndroid || !nav.serial)) return imprimirBle(nav.bluetooth, bytes);
  if (nav.serial) return escribirSerial(await nav.serial.requestPort(), bytes);
  throw new Error("Este navegador no puede imprimir directo");
}

/* --------------------------------- Serial --------------------------------- */

/** Calibración por impresora: el SPP ignora el baud, pero algunas por cable no. */
const BAUD_RATE = 9600;

async function escribirSerial(port: SerialPortLike, bytes: Uint8Array): Promise<void> {
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

/* ---------------------------------- BLE ----------------------------------- */

/**
 * Servicios GATT de "UART transparente" que usan las térmicas BLE baratas.
 * Web Bluetooth sólo deja tocar los servicios listados aquí: si una
 * impresora no imprime, falta su UUID en esta lista.
 */
const BLE_SERVICIOS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
];

/** Bytes por escritura. Más grande imprime más rápido; si el ticket sale cortado, bajarlo (mínimo seguro: 20). */
const BLE_CHUNK = 100;

let bleDevice: BleDevice | null = null;
let bleChar: BleCharacteristic | null = null;

async function imprimirBle(bt: BluetoothLike, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  // ponytail: el dispositivo se recuerda sólo en memoria; tras recargar se
  // vuelve a elegir, salvo que el navegador ya exponga `getDevices()`.
  bleDevice ??= (await bt.getDevices?.())?.[0] ?? null;
  if (!bleDevice) {
    bleDevice = await bt.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICIOS });
  }
  if (!bleChar || !bleDevice.gatt?.connected) {
    try {
      bleChar = await caracteristicaEscritura(bleDevice);
    } catch (err) {
      bleDevice = bleChar = null; // la próxima vez se vuelve a elegir
      throw err;
    }
  }
  const char = bleChar;
  // Con respuesta cuando se puede: es el control de flujo que evita
  // desbordar el búfer de la impresora con los KB de una imagen.
  const escribir = char.properties.write
    ? (c: Uint8Array<ArrayBuffer>) => char.writeValueWithResponse(c)
    : (c: Uint8Array<ArrayBuffer>) => char.writeValueWithoutResponse(c);
  for (let i = 0; i < bytes.length; i += BLE_CHUNK) {
    await escribir(bytes.slice(i, i + BLE_CHUNK));
  }
}

async function caracteristicaEscritura(device: BleDevice): Promise<BleCharacteristic> {
  if (!device.gatt) throw new Error("El dispositivo elegido no es una impresora BLE");
  const server = await device.gatt.connect();
  for (const servicio of await server.getPrimaryServices()) {
    for (const c of await servicio.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
  }
  throw new Error("La impresora no expone un canal de impresión conocido");
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
  /** Imagen 1 bit (`GS v 0`); respeta `align`. */
  image(r: Raster): this {
    this.buf.push(GS, 0x76, 0x30, 0, r.bytesFila & 0xff, r.bytesFila >> 8, r.alto & 0xff, r.alto >> 8);
    for (const b of r.bits) this.buf.push(b);
    return this;
  }
  /**
   * Avanza el papel hasta la cuchilla y corta. `GS V 66 n` (función B) es
   * el corte "avanza y corta" que calcula solo la distancia a la cuchilla;
   * el `GS V 1` de después es para las que sólo entienden la función A. Las
   * portátiles sin cuchilla ignoran ambos: el avance deja el ticket listo
   * para rasgar en la sierra.
   */
  bytes(): Uint8Array<ArrayBuffer> {
    this.buf.push(ESC, 0x64, AVANCE_FINAL, GS, 0x56, 0x42, 0, GS, 0x56, 0x01);
    return Uint8Array.from(this.buf);
  }
}

/** Líneas en blanco antes del corte: que el pie no quede bajo el cabezal. */
const AVANCE_FINAL = 4;

export interface Raster {
  bytesFila: number;
  alto: number;
  bits: Uint8Array;
}

/**
 * Carga una imagen (PNG, SVG como data URL…) a `ancho` puntos y la pasa a 1
 * bit: negro donde es oscura y opaca, blanco lo demás (el fondo transparente
 * del PNG queda en blanco). 8 puntos = 1mm en térmicas de 203dpi.
 */
export async function rasterizar(src: string, ancho: number): Promise<Raster> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const alto = Math.round((ancho * img.naturalHeight) / img.naturalWidth) || ancho;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, ancho, alto);
  const { data } = ctx.getImageData(0, 0, ancho, alto);
  const bytesFila = Math.ceil(ancho / 8);
  const bits = new Uint8Array(bytesFila * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      const luz = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (data[i + 3] >= 128 && luz < 128) bits[y * bytesFila + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { bytesFila, alto, bits };
}
