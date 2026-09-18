import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import {
  FacturaMesaTicket,
  type FacturaMesaData,
  type FacturaPaperWidth,
} from "./FacturaMesaTicket";

const PRINT_TARGET_ID = "factura-print";

/**
 * El tamaño del papel en el diálogo de impresión lo decide `@page { size }` y
 * NADA más: no lee variables CSS ni se puede condicionar por clase, hay que
 * escribir la regla con el ancho puesto. `global.css` sólo declaraba
 * `@page { margin: 0 }`, así que el navegador asumía su default —Carta/A4— y
 * mandaba el ticket de 58mm centrado en una hoja enorme.
 *
 * El alto va en `auto` a propósito: el rollo térmico es continuo, no tiene
 * páginas. Fijarle una altura cortaría el recibo largo o escupiría papel en
 * blanco en el corto.
 *
 * Se inyecta y se retira con el modal para no dejarle este `@page` puesto al
 * resto de la app, que sí imprime en hoja normal.
 */
function usePrintPageSize(width: FacturaPaperWidth, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const style = document.createElement("style");
    style.setAttribute("data-factura-print", "");
    style.textContent = `@page { size: ${width} auto; margin: 0; }`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [width, enabled]);
}

export interface FacturaMesaModalProps {
  open: boolean;
  onClose: () => void;
  data: FacturaMesaData | null;
}

/**
 * Preview + impresión de la factura de cobro de una mesa.
 *
 * `FacturaMesaTicket` se renderiza DOS VECES a propósito:
 *
 * 1. Dentro del `Modal` (Radix `Dialog`), para que el usuario vea el recibo
 *    antes de imprimir. Esta copia nunca lleva `id="factura-print"`.
 * 2. En un `createPortal` directo a `document.body` — fuera del árbol del
 *    Dialog — con `id="factura-print"`, que es lo único que la regla
 *    `@media print` de `global.css` deja visible al imprimir.
 *
 * La copia (2) existe porque el contenido de un Radix `DialogContent` se
 * centra con `transform: translate(...)`, y eso crea un containing block
 * nuevo para cualquier descendiente `position: fixed` — el ticket dejaría de
 * anclarse al viewport/página impresa y se ancla al recuadro del modal en su
 * lugar, lo que puede recortar o desubicar el recibo en la vista previa de
 * impresión del navegador. Portarlo directo a `<body>` evita ese problema de
 * raíz en vez de pelear con el `transform` del diálogo.
 *
 * No se probó contra una impresora térmica física en esta sesión (no hay
 * hardware disponible) — se probó leyendo la vista previa de impresión del
 * navegador. El tamaño físico del rollo (58mm/80mm) lo define el driver de la
 * impresora; este componente sólo garantiza que el contenido mismo mida
 * exactamente ese ancho y que `@page` no le agregue márgenes.
 */
export function FacturaMesaModal({ open, onClose, data }: FacturaMesaModalProps) {
  const [paperWidth, setPaperWidth] = useState<FacturaPaperWidth>("58mm");

  usePrintPageSize(paperWidth, open && data != null);

  return (
    <>
      <Modal
        open={open && data != null}
        onClose={onClose}
        title="Factura de cobro"
        description={data ? `Mesa ${data.mesaEtiqueta}` : undefined}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={() => window.print()} disabled={!data}>
              <Printer size={14} /> Imprimir
            </Button>
          </>
        }
      >
        {data && (
          <div className="flex flex-col items-center gap-4">
            <PaperWidthToggle value={paperWidth} onChange={setPaperWidth} />
            <div className="w-full overflow-x-auto rounded-[var(--radius-md)] border border-dashed border-border bg-surface-sunken p-4">
              <FacturaMesaTicket data={data} paperWidth={paperWidth} className="shadow-[var(--shadow-token-md)]" />
            </div>
          </div>
        )}
      </Modal>

      {/* Blanco de impresión — fuera del Dialog, ver el comentario de arriba. */}
      {data &&
        createPortal(
          <div className="hidden print:block">
            <FacturaMesaTicket data={data} paperWidth={paperWidth} id={PRINT_TARGET_ID} />
          </div>,
          document.body,
        )}
    </>
  );
}

function PaperWidthToggle({
  value,
  onChange,
}: {
  value: FacturaPaperWidth;
  onChange: (next: FacturaPaperWidth) => void;
}) {
  const options: FacturaPaperWidth[] = ["58mm", "80mm"];
  return (
    <div
      role="radiogroup"
      aria-label="Ancho del papel"
      className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-raised p-1"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
            value === option
              ? "bg-active text-active-fg"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
