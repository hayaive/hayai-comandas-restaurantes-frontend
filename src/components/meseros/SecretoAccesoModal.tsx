import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useRestauranteStore } from "@/lib/useRestauranteStore";

/**
 * Muestra el enlace y/o el código recién creados o regenerados — UNA sola
 * vez, tal como lo deja claro el contrato ("después no se pueden
 * recuperar"). Se reusa para las dos situaciones (`createAcceso` y
 * `regenerarAcceso`, que puede traer sólo uno de los dos si el dueño pidió
 * regenerar nada más el código o nada más el enlace).
 */
export interface SecretoAccesoModalProps {
  open: boolean;
  onClose: () => void;
  nombre: string;
  enlace?: string;
  codigo?: string;
}

function construirMensaje(nombreRestaurante: string, nombre: string, enlace?: string, codigo?: string): string {
  const partes = [`Hola ${nombre}, este es tu acceso a ${nombreRestaurante}:`];
  if (enlace) partes.push(enlace);
  if (codigo) partes.push(`Tu código es: ${codigo}`);
  return partes.join("\n");
}

export function SecretoAccesoModal({ open, onClose, nombre, enlace, codigo }: SecretoAccesoModalProps) {
  const [copiado, setCopiado] = useState<"enlace" | "codigo" | null>(null);
  const nombreRestaurante = useRestauranteStore((s) => s.restaurante?.nombre ?? "el restaurante");

  async function copiar(texto: string, cual: "enlace" | "codigo") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      window.setTimeout(() => setCopiado((actual) => (actual === cual ? null : actual)), 1500);
    } catch {
      // Sin acceso al portapapeles (permiso denegado, contexto no seguro):
      // el texto sigue visible en pantalla para copiarlo a mano.
    }
  }

  function compartirPorWhatsapp() {
    const mensaje = construirMensaje(nombreRestaurante, nombre, enlace, codigo);
    // ⚠️ El enlace lleva un `#<token>` — sin `encodeURIComponent` ese `#`
    // corta el mensaje ahí mismo y el mesero recibe la URL SIN el token.
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enlace y código listos"
      description={`Guárdalos ahora — no se pueden volver a ver.`}
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">
          Esta es la ÚNICA vez que {nombre} — o tú — van a ver este enlace y este código. Si se
          pierden, la única opción es regenerarlos (invalida los anteriores).
        </p>

        {enlace && (
          <SecretoRow
            label="Enlace"
            valor={enlace}
            copiado={copiado === "enlace"}
            onCopiar={() => void copiar(enlace, "enlace")}
          />
        )}
        {codigo && (
          <SecretoRow
            label="Código"
            valor={codigo}
            mono
            copiado={copiado === "codigo"}
            onCopiar={() => void copiar(codigo, "codigo")}
          />
        )}

        <Button variant="primary" className="w-full" onClick={compartirPorWhatsapp}>
          <Share2 size={14} /> Compartir por WhatsApp
        </Button>
      </div>
    </Modal>
  );
}

function SecretoRow({
  label,
  valor,
  mono,
  copiado,
  onCopiar,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-fg-subtle">{label}</p>
        <p className={mono ? "truncate font-mono text-lg tracking-[0.3em] text-fg" : "truncate text-[13px] text-fg"}>
          {valor}
        </p>
      </div>
      <IconButton
        icon={copiado ? <Check size={15} /> : <Copy size={15} />}
        label={`Copiar ${label.toLowerCase()}`}
        variant="outline"
        size="sm"
        onClick={onCopiar}
      />
    </div>
  );
}
