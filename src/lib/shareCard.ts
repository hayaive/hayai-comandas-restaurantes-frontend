import type { Reservacion } from "@/api";
import { resolveMediaUrl } from "@/api/mediaUrl";
import { formatDateTime } from "@/lib/format";
import { useRestauranteStore } from "@/lib/useRestauranteStore";

/**
 * Compositor de la tarjeta de reserva que se comparte por WhatsApp.
 *
 * Todo se dibuja sobre un `<canvas>` offscreen con la API 2D — el brief pide
 * explícitamente NO agregar una dependencia nueva (no hay `html2canvas` ni
 * similar en el proyecto), así que esto es Canvas 2D puro: `drawImage` para
 * el QR (ya es un `<canvas>` real de `qrcode.react`) y el logo (`<img>`
 * cargado a mano), y `fillText`/`measureText` para todo el texto.
 *
 * ---------------------------------------------------------------------
 * POR QUÉ LOS COLORES ESTÁN EN HEX LITERAL Y NO COMO `var(--token)`
 * ---------------------------------------------------------------------
 * `DESIGN.md` prohíbe hardcodear un hex "en un componente" — pero esto no es
 * un componente de la UI del producto, es un renderizador de imagen offline.
 * Un `<canvas>` 2D no entiende custom properties de CSS: `ctx.fillStyle`
 * necesita un color resuelto, no `var(--fg)`. La alternativa real sería leer
 * `getComputedStyle(document.documentElement).getPropertyValue(...)` en
 * tiempo de ejecución, pero eso traería el problema opuesto: si quien genera
 * la tarjeta tiene el modo oscuro activo, `--fg`/`--bg` están invertidos
 * (texto casi blanco, superficie casi negra) y la tarjeta saldría con
 * colores invertidos e ilegibles. Esta tarjeta sale de la app hacia
 * WhatsApp — es un artefacto para el cliente, no una superficie de la app —
 * y debe verse SIEMPRE igual sin importar el tema de quien la generó,
 * exactamente el mismo criterio que ya usa `FacturaMesaTicket.tsx`
 * (`bg-white text-black` fijos, literales, para el ticket impreso). Los
 * valores de abajo son una copia 1:1 de los tokens en modo claro de
 * `src/styles/tokens.css`; si esos tokens cambian, actualizar aquí también.
 */
const COLORS = {
  cardBg: "#ffffff", // --n-0 / --surface
  headerFrom: "#8a5a35", // --grad-brand-from
  headerVia: "#6f4a2e", // --grad-brand-via
  headerTo: "#46301e", // --grad-brand-to
  fg: "#141414", // --n-950 / --fg
  fgMuted: "#525252", // --n-600 / --fg-muted
  fgSubtle: "#6b6b6b", // --n-500 / --fg-subtle
  border: "#e5e5e5", // --n-150 / --border
  surfaceSunken: "#f5f5f5", // --n-50 / --surface-sunken
  active: "#6f4a2e", // --active-bg
  activeFg: "#ffffff", // --active-fg
  white: "#ffffff",
  whiteSoft: "rgba(255,255,255,0.85)",
  whiteFaint: "rgba(255,255,255,0.35)",
  shadow: "rgba(20,14,8,0.22)",
} as const;

const FONT_SANS = '"Geist Variable"';
const FONT_MONO = '"Geist Mono Variable"';

const font = {
  sansSemibold: (px: number) => `600 ${px}px ${FONT_SANS}`,
  sansMedium: (px: number) => `500 ${px}px ${FONT_SANS}`,
  sansRegular: (px: number) => `400 ${px}px ${FONT_SANS}`,
  monoBold: (px: number) => `700 ${px}px ${FONT_MONO}`,
  monoMedium: (px: number) => `500 ${px}px ${FONT_MONO}`,
};

// --- Geometría de la tarjeta (px lógicos, antes de multiplicar por el
// factor de exportación — ver `exportScale` en `buildReservationShareCard`).
const CARD_W = 680;
const PAD_X = 56;
const CONTENT_W = CARD_W - PAD_X * 2;

const HEADER_H = 224;
const LOGO_D = 96;

const QR_PANEL = 272;
const QR_PANEL_PAD = 24;
/** Tamaño lógico al que debe pintarse el `<QRCodeCanvas>` oculto que sirve de fuente. */
export const SHARE_CARD_QR_LOGICAL_SIZE = QR_PANEL - QR_PANEL_PAD * 2;

/**
 * Mensaje cálido impreso EN la tarjeta (distinto del texto que acompaña el
 * envío por WhatsApp, que vive en `QrCodeModal.tsx` porque necesita el
 * nombre del cliente y el enlace). Breve, sin exclamaciones de sobra: es un
 * restaurante confirmando una reserva, no una tarjeta de cumpleaños.
 */
const CARD_MENSAJE =
  "Te esperamos con gusto. Muestra este código al llegar para hacer tu check-in.";

export interface BuildShareCardOptions {
  /** El `<canvas>` de `qrcode.react`, ya pintado, usado sólo como fuente de píxeles. */
  qrCanvas: HTMLCanvasElement;
  reservacion: Reservacion;
  restauranteNombre: string;
  /** `Math.max(devicePixelRatio, 2)` típicamente — ver `QrCodeModal.tsx`. */
  exportScale: number;
}

/** Construye la tarjeta y devuelve el PNG final como `Blob`, listo para descargar o compartir. */
export async function buildReservationShareCard(
  opts: BuildShareCardOptions,
): Promise<Blob> {
  const { qrCanvas, reservacion, restauranteNombre, exportScale } = opts;

  await ensureFontsReady();
  // `getState()` en vez del hook: esta función no es un componente, se llama
  // desde un `useEffect` de `QrCodeModal` — mismo patrón que
  // `facturaMesaData.ts` usa para leer el mismo store fuera de un render.
  const logoUrlConfigurado = useRestauranteStore.getState().restaurante?.logoUrl ?? null;
  // Sin logo configurado, sigue cayendo al estático local (mismo origen que
  // la app, comportamiento sin cambios). Con uno configurado, vive en el
  // origen del BACKEND — `resolveMediaUrl` lo resuelve contra `VITE_API_URL`.
  const logoSrc = logoUrlConfigurado ? resolveMediaUrl(logoUrlConfigurado)! : "/logo.jpg";
  const logo = await loadImage(logoSrc);

  // Pase 1 — medir. Un <canvas> no puede "crecer" después de dibujar sin
  // perder lo ya pintado, así que el alto final (que depende del nombre del
  // cliente y del mensaje, ambos de longitud variable) hay que conocerlo
  // ANTES de crear el canvas real. Este canvas de medición nunca se pinta.
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) throw new Error("Este navegador no soporta Canvas 2D.");
  const cardHeight = renderCard(mctx, {
    reservacion,
    restauranteNombre,
    logo,
    qrCanvas,
    draw: false,
    cardHeight: 0,
  });

  // Pase 2 — el canvas real, ya con el alto correcto.
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(CARD_W * exportScale);
  canvas.height = Math.round(cardHeight * exportScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no soporta Canvas 2D.");
  // Todo el resto del código dibuja en coordenadas lógicas (las de
  // CARD_W/cardHeight); este scale es lo único que cuida el device pixel
  // ratio para que el texto no salga borroso.
  ctx.scale(exportScale, exportScale);
  renderCard(ctx, { reservacion, restauranteNombre, logo, qrCanvas, draw: true, cardHeight });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo exportar la tarjeta como imagen."));
    }, "image/png");
  });
}

interface RenderParams {
  reservacion: Reservacion;
  restauranteNombre: string;
  logo: HTMLImageElement;
  qrCanvas: HTMLCanvasElement;
  /** false en el pase de medición: no se dibuja nada, sólo se calculan posiciones. */
  draw: boolean;
  /** Alto final ya conocido — sólo se usa (y sólo hace falta) cuando `draw` es true. */
  cardHeight: number;
}

/**
 * Dibuja la tarjeta completa y devuelve el alto total que ocupó.
 *
 * Se llama dos veces con la MISMA lógica (una para medir, otra para pintar)
 * en vez de tener dos funciones separadas — así el alto medido en el pase 1
 * no puede desincronizarse nunca del contenido realmente dibujado en el
 * pase 2, porque es literalmente el mismo código el que decide ambos.
 */
function renderCard(ctx: CanvasRenderingContext2D, params: RenderParams): number {
  const { reservacion, restauranteNombre, logo, qrCanvas, draw, cardHeight } = params;

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  if (draw) {
    // Fondo "papel" a todo lo alto, dibujado primero para que el header (que
    // sólo cubre los primeros HEADER_H px) quede encima sin dejar huecos.
    ctx.fillStyle = COLORS.cardBg;
    ctx.fillRect(0, 0, CARD_W, cardHeight);

    // --- Header: degradado de marca (el mismo `--grad-brand-*` reservado
    // en DESIGN.md para "brand moments" como el FAB — esta tarjeta, que es
    // literalmente el momento en que la marca llega al cliente, califica).
    const gradient = ctx.createLinearGradient(0, 0, CARD_W, HEADER_H);
    gradient.addColorStop(0, COLORS.headerFrom);
    gradient.addColorStop(0.55, COLORS.headerVia);
    gradient.addColorStop(1, COLORS.headerTo);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_W, HEADER_H);
  }

  const centerX = CARD_W / 2;

  // Logo: circular, recortado del sello cuadrado (public/logo.jpg). El
  // cuadrado ya es fondo marrón uniforme fuera del círculo del sello, así
  // que recortar a un círculo no deja ninguna esquina cuadrada visible.
  const logoTop = 28;
  const logoCenterY = logoTop + LOGO_D / 2;
  if (draw) {
    ctx.save();
    // Sombra suave detrás del logo — se dibuja como un relleno aparte porque
    // una sombra aplicada directamente sobre una imagen recortada (clip)
    // sale distorsionada/recortada junto con la imagen.
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = COLORS.headerTo;
    ctx.beginPath();
    ctx.arc(centerX, logoCenterY, LOGO_D / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, logoCenterY, LOGO_D / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      logo,
      centerX - LOGO_D / 2,
      logoCenterY - LOGO_D / 2,
      LOGO_D,
      LOGO_D,
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, logoCenterY, LOGO_D / 2, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.whiteFaint;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Nombre del restaurante — una sola línea, con auto-reducción de tamaño
  // por si `VITE_RESTAURANTE_NOMBRE` llegara a ser inusualmente largo (el
  // header tiene alto fijo: no hay espacio para una segunda línea aquí).
  const nameTop = logoTop + LOGO_D + 22;
  const nameMaxWidth = CARD_W - 96;
  const nameSize = fitFontSize(ctx, restauranteNombre, font.sansSemibold, 26, 16, nameMaxWidth);
  const nameH = nameSize * 1.2;
  if (draw) {
    ctx.font = font.sansSemibold(nameSize);
    ctx.fillStyle = COLORS.white;
    ctx.fillText(restauranteNombre, centerX, nameTop + nameH / 2, nameMaxWidth);
  }

  // Subtítulo tracked, mismo tratamiento tipográfico que las demás
  // etiquetas en mayúsculas de la tarjeta (ver `drawTracked`).
  const subtitleTop = nameTop + nameH + 6;
  const subtitleSize = 12;
  if (draw) {
    ctx.font = font.sansMedium(subtitleSize);
    drawTracked(ctx, "RESERVA CONFIRMADA", centerX, subtitleTop + subtitleSize * 0.85, 1.6, COLORS.whiteSoft);
  }

  // --- Cuerpo ---------------------------------------------------------
  let y = HEADER_H + 32;

  // Panel del QR: tarjeta blanca con borde y sombra, el QR adentro con aire
  // de sobra alrededor — ese aire cumple el rol de la "quiet zone" que el
  // QR pelado del modal anterior no tenía (no se le pasaba `marginSize`).
  {
    const panelX = centerX - QR_PANEL / 2;
    const panelY = y;
    if (draw) {
      ctx.save();
      ctx.shadowColor = "rgba(20,14,8,0.12)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, panelX, panelY, QR_PANEL, QR_PANEL, 24);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      ctx.restore();

      roundRect(ctx, panelX, panelY, QR_PANEL, QR_PANEL, 24);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      const qrSize = SHARE_CARD_QR_LOGICAL_SIZE;
      const qrX = panelX + (QR_PANEL - qrSize) / 2;
      const qrY = panelY + (QR_PANEL - qrSize) / 2;
      // Un QR no es una foto: si el navegador interpola al dibujarlo, los
      // bordes entre módulos se vuelven gris y el escáner deja de resolverlos.
      // `QrCodeModal` ya pide el canvas al tamaño exacto para que no haya
      // reescalado, pero esto es la segunda línea de defensa y es gratis: si
      // por lo que sea las medidas no cuadran al píxel, prefiero módulos
      // dentados a módulos difuminados — lo primero se escanea, lo segundo no.
      const suavizadoPrevio = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
      ctx.imageSmoothingEnabled = suavizadoPrevio;
    }
    y += QR_PANEL + 24;
  }

  // Código corto — caption + chip, igual al `Badge tone="active"` que ya
  // usaba el modal original.
  {
    const captionSize = 12;
    if (draw) {
      ctx.font = font.sansMedium(captionSize);
      drawTracked(ctx, "CÓDIGO PARA LA PUERTA", centerX, y + captionSize * 0.85, 1.2, COLORS.fgSubtle);
    }
    y += captionSize + 10;

    const chipFont = font.monoBold(18);
    const chipH = 38;
    const chipPadX = 20;
    // Fuente fijada ANTES de medir, sin importar `draw`: chipW no se usa en
    // el pase de medición (chipH es fijo, no depende del ancho del código),
    // pero dejar `ctx.font` en un valor real aquí evita que quien lea este
    // código tenga que razonar si el measureText de abajo es correcto.
    ctx.font = chipFont;
    const textW = ctx.measureText(reservacion.codigoCorto).width;
    const chipW = textW + chipPadX * 2;
    if (draw) {
      roundRect(ctx, centerX - chipW / 2, y, chipW, chipH, 12);
      ctx.fillStyle = COLORS.active;
      ctx.fill();
      ctx.font = chipFont;
      ctx.fillStyle = COLORS.activeFg;
      ctx.fillText(reservacion.codigoCorto, centerX, y + chipH / 2 + 1);
    }
    y += chipH + 26;
  }

  y = drawDivider(ctx, y, draw);

  // Fecha y hora — una sola línea con `formatDateTime` (el formateador ya
  // existente del proyecto; no se escribió uno nuevo). Los números van en
  // mono por la regla del design system para cifras/horas.
  {
    const captionSize = 12;
    if (draw) {
      ctx.font = font.sansMedium(captionSize);
      drawTracked(ctx, "FECHA Y HORA", centerX, y + captionSize * 0.85, 1.2, COLORS.fgSubtle);
    }
    y += captionSize + 8;

    const value = formatDateTime(reservacion.iniciaEn);
    const valueSize = fitFontSize(ctx, value, font.monoBold, 22, 15, CONTENT_W);
    const valueH = valueSize * 1.25;
    if (draw) {
      ctx.font = font.monoBold(valueSize);
      ctx.fillStyle = COLORS.fg;
      ctx.fillText(value, centerX, y + valueH / 2, CONTENT_W);
    }
    y += valueH + 26;
  }

  // Nombre del cliente — hasta 2 líneas, con elipsis si ni así entra (caso
  // límite deliberado: un nombre absurdamente largo no debe romper el
  // layout ni desbordar el ancho de la tarjeta).
  {
    const captionSize = 12;
    if (draw) {
      ctx.font = font.sansMedium(captionSize);
      drawTracked(ctx, "RESERVA DE", centerX, y + captionSize * 0.85, 1.2, COLORS.fgSubtle);
    }
    y += captionSize + 8;

    const nameFontSize = 22;
    ctx.font = font.sansSemibold(nameFontSize);
    const wrapped = clampLines(ctx, wrapText(ctx, reservacion.clienteNombre, CONTENT_W), 2, CONTENT_W);
    const lineH = nameFontSize * 1.28;
    if (draw) {
      ctx.fillStyle = COLORS.fg;
      wrapped.forEach((line, i) => {
        ctx.fillText(line, centerX, y + lineH * i + lineH / 2, CONTENT_W);
      });
    }
    y += lineH * wrapped.length + 22;
  }

  // Fila de datos: personas siempre, mesa sólo si ya hay una asignada — sin
  // dejar un hueco ni imprimir "null" cuando `mesaEtiqueta` es `null`.
  {
    const chips: { segments: TextSegment[] }[] = [
      {
        segments: [
          { text: `${reservacion.personas}`, font: font.monoBold(14), color: COLORS.fgMuted },
          { text: reservacion.personas === 1 ? " persona" : " personas", font: font.sansMedium(14), color: COLORS.fgMuted },
        ],
      },
    ];
    if (reservacion.mesaEtiqueta) {
      chips.push({
        segments: [
          { text: "Mesa ", font: font.sansMedium(14), color: COLORS.fgMuted },
          { text: reservacion.mesaEtiqueta, font: font.monoBold(14), color: COLORS.fgMuted },
        ],
      });
    }

    const chipPadX = 16;
    const chipH = 32;
    const gap = 10;
    const widths = chips.map((c) => measureSegments(ctx, c.segments) + chipPadX * 2);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    if (draw) {
      let x = centerX - totalW / 2;
      chips.forEach((chip, i) => {
        const w = widths[i];
        roundRect(ctx, x, y, w, chipH, 12);
        ctx.fillStyle = COLORS.surfaceSunken;
        ctx.fill();
        roundRect(ctx, x, y, w, chipH, 12);
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.stroke();
        drawSegmentsCentered(ctx, chip.segments, x + w / 2, y + chipH / 2 + 1);
        x += w + gap;
      });
    }
    y += chipH + 26;
  }

  y = drawDivider(ctx, y, draw);

  // Mensaje cálido.
  {
    const msgSize = 15;
    ctx.font = font.sansRegular(msgSize);
    const wrapped = wrapText(ctx, CARD_MENSAJE, CONTENT_W);
    const lineH = msgSize * 1.55;
    if (draw) {
      ctx.fillStyle = COLORS.fgMuted;
      wrapped.forEach((line, i) => {
        ctx.fillText(line, centerX, y + lineH * i + lineH / 2, CONTENT_W);
      });
    }
    y += lineH * wrapped.length + 28;
  }

  // Pie: sólo una firma discreta — el mensaje y el QR ya hicieron el
  // trabajo, esto es sólo la marca del pie de página.
  {
    const footSize = 11;
    if (draw) {
      ctx.font = font.sansMedium(footSize);
      drawTracked(
        ctx,
        `${restauranteNombre.toUpperCase()} · RESERVAS`,
        centerX,
        y + footSize * 0.85,
        1.4,
        COLORS.fgSubtle,
      );
    }
    y += footSize + 32;
  }

  return y;
}

function drawDivider(ctx: CanvasRenderingContext2D, y: number, draw: boolean): number {
  if (draw) {
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_X, y);
    ctx.lineTo(CARD_W - PAD_X, y);
    ctx.stroke();
  }
  return y + 1 + 26;
}

// --- Helpers de dibujo ------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * `letter-spacing` no es fiable entre navegadores en Canvas 2D (Safari no
 * soporta `ctx.letterSpacing`), así que las etiquetas trackeadas en
 * mayúsculas se dibujan carácter a carácter con un espaciado fijo.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
  color: string,
) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = centerX - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

interface TextSegment {
  text: string;
  font: string;
  color: string;
}

function measureSegments(ctx: CanvasRenderingContext2D, segments: TextSegment[]): number {
  return segments.reduce((sum, seg) => {
    ctx.font = seg.font;
    return sum + ctx.measureText(seg.text).width;
  }, 0);
}

/** Dibuja varios segmentos con fuentes/colores distintos en fila, centrados como grupo. */
function drawSegmentsCentered(
  ctx: CanvasRenderingContext2D,
  segments: TextSegment[],
  centerX: number,
  y: number,
) {
  const total = measureSegments(ctx, segments);
  let x = centerX - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const seg of segments) {
    ctx.font = seg.font;
    ctx.fillStyle = seg.color;
    ctx.fillText(seg.text, x, y);
    x += ctx.measureText(seg.text).width;
  }
  ctx.textAlign = prevAlign;
}

/**
 * Reduce el tamaño de fuente (de `max` a `min`, de 1 en 1px) hasta que
 * `text` entre en una sola línea de `maxWidth`. Devuelve el tamaño elegido;
 * si ni con `min` entra, se queda en `min` (el texto se corta al dibujar
 * pasando `maxWidth` a `fillText`, que igual nunca desborda el layout).
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFn: (px: number) => string,
  max: number,
  min: number,
  maxWidth: number,
): number {
  for (let size = max; size > min; size--) {
    ctx.font = fontFn(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return min;
}

/**
 * Word-wrap manual (Canvas 2D no lo hace solo). Si una sola "palabra" ya
 * desborda `maxWidth` por sí sola (un nombre pegado sin espacios, por
 * ejemplo) se corta carácter a carácter en vez de desbordar la tarjeta.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";

  const hardBreak = (word: string): string => {
    let piece = "";
    for (const ch of word) {
      const next = piece + ch;
      if (piece && ctx.measureText(next).width > maxWidth) {
        lines.push(piece);
        piece = ch;
      } else {
        piece = next;
      }
    }
    return piece;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    current = ctx.measureText(word).width <= maxWidth ? word : hardBreak(word);
  }
  if (current) lines.push(current);
  return lines;
}

/** Recorta a `maxLines` y agrega "…" a la última si hubo que cortar contenido. */
function clampLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxLines: number,
  maxWidth: number,
): string[] {
  if (lines.length <= maxLines) return lines;
  const clamped = lines.slice(0, maxLines);
  let last = clamped[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  clamped[maxLines - 1] = `${last}…`;
  return clamped;
}

/**
 * Espera a que Geist/Geist Mono estén realmente cargadas antes de medir o
 * dibujar texto. A diferencia del DOM, `CanvasRenderingContext2D.fillText`
 * NO espera una fuente `@font-face` en proceso de carga — si se dibuja
 * antes de tiempo, cae en el fallback del sistema en silencio y el texto
 * sale con una tipografía distinta (y con métricas distintas a las que se
 * usaron para medir el layout). Mismo motivo por el que el logo espera su
 * propio `onload` más abajo.
 */
async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`600 16px ${FONT_SANS}`),
      document.fonts.load(`500 16px ${FONT_SANS}`),
      document.fonts.load(`400 16px ${FONT_SANS}`),
      document.fonts.load(`700 16px ${FONT_MONO}`),
      document.fonts.load(`500 16px ${FONT_MONO}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Si la API de fuentes falla por lo que sea, se sigue con lo que el
    // navegador tenga disponible — mejor una tarjeta con la tipografía de
    // respaldo que ninguna tarjeta.
  }
}

/**
 * `crossOrigin = "anonymous"` es OBLIGATORIO desde que el logo puede venir
 * configurado (Configuración → `Restaurante.logoUrl`): esa imagen vive en el
 * origen del BACKEND, no en el de esta app, y `app.useStaticAssets` del lado
 * del servidor no manda cabeceras CORS por defecto. Dibujar una imagen
 * cross-origin SIN esto en un `<canvas>` lo "contamina" (`canvas.toBlob()`
 * lanza `SecurityError` más abajo, silenciosamente, sólo al intentar
 * exportar) — el error no sale aquí, sale más tarde y es confuso de rastrear
 * si no se sabe de esto de antemano. El backend necesita las cabeceras CORS
 * en su handler de estáticos; esto solo es la mitad del arreglo que le toca
 * al frontend, ver diseño §7.2.
 *
 * Para el estático local (`/logo.jpg`, mismo origen que esta app) el atributo
 * es un no-op inofensivo: una petición same-origin no depende de cabeceras
 * CORS para pasar, así que no hace falta ramificar según el origen.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}.`));
    img.src = src;
  });
}
