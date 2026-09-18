import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { navItems } from "@/components/layout/navItems";
import { useAccesoStore } from "@/lib/useAccesoStore";
import { formatTime } from "@/lib/format";
import { ApiError } from "@/api";
import type { AccesoCreadoResult, AccesoTemporal, DuracionAcceso, ModuloApp } from "@/api";

/** Los 9 módulos cedibles, en el mismo orden que la navegación — Configuración y Meseros nunca aparecen aquí. */
const MODULOS_ASIGNABLES: ModuloApp[] = navItems
  .map((item) => item.modulo)
  .filter((modulo): modulo is ModuloApp => modulo !== "configuracion" && modulo !== "meseros");

/** Aviso de que el módulo es una pantalla COMPLETA, no un permiso fino — el brief lo pide explícito para estos dos. */
const HINTS: Partial<Record<ModuloApp, string>> = {
  productos: "Incluye cambiar precios.",
  mesas: "Incluye editar el plano del salón.",
};

const ICONO_POR_MODULO = new Map(navItems.map((item) => [item.modulo, item.icon]));
const LABEL_POR_MODULO = new Map(navItems.map((item) => [item.modulo, item.label]));

const DURACIONES: { value: DuracionAcceso; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "2_dias", label: "2 días" },
  { value: "1_semana", label: "1 semana" },
  { value: "1_mes", label: "1 mes" },
];

/** "sáb 05:00" — día corto + hora, el formato que pide el brief para el atajo de duración. */
function formatVencimientoCorto(iso: string): string {
  const dia = new Date(iso).toLocaleDateString("es-VE", { weekday: "short" });
  return `${dia} ${formatTime(iso)}`;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}

export interface AccesoFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` = crear un acceso nuevo. Con valor = editando ese acceso. */
  editing: AccesoTemporal | null;
  /** Sólo se dispara al CREAR — la pantalla abre el modal de "enlace y código" con el resultado. */
  onCreated: (resultado: AccesoCreadoResult) => void;
}

export function AccesoFormModal({ open, onClose, editing, onCreated }: AccesoFormModalProps) {
  const accesos = useAccesoStore((s) => s.accesos);
  const vencimientos = useAccesoStore((s) => s.vencimientos);
  const vencimientosStatus = useAccesoStore((s) => s.vencimientosStatus);
  const loadVencimientos = useAccesoStore((s) => s.loadVencimientos);
  const crear = useAccesoStore((s) => s.crear);
  const actualizar = useAccesoStore((s) => s.actualizar);

  const [nombre, setNombre] = useState("");
  const [modulos, setModulos] = useState<Set<ModuloApp>>(new Set());
  const [duracion, setDuracion] = useState<DuracionAcceso>("hoy");
  /** Sólo aplica en edición: por defecto NO se toca el vencimiento al editar nombre/módulos. */
  const [extenderVencimiento, setExtenderVencimiento] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada apertura arranca desde el acceso a editar (o en blanco al crear) —
  // sin esto, cerrar sin guardar y volver a abrir para OTRO acceso dejaría
  // los campos del anterior pegados.
  useEffect(() => {
    if (!open) return;
    setNombre(editing?.nombre ?? "");
    setModulos(new Set(editing?.modulos ?? []));
    setDuracion("hoy");
    setExtenderVencimiento(false);
    setError(null);
    void loadVencimientos();
  }, [open, editing, loadVencimientos]);

  const nombreNormalizado = nombre.trim().toLowerCase();
  const nombreDuplicado = useMemo(() => {
    if (!nombreNormalizado) return false;
    return accesos.some(
      (a) => a.id !== editing?.id && a.nombre.trim().toLowerCase() === nombreNormalizado,
    );
  }, [accesos, nombreNormalizado, editing]);

  function toggleModulo(modulo: ModuloApp) {
    setModulos((prev) => {
      const next = new Set(prev);
      if (next.has(modulo)) next.delete(modulo);
      else next.add(modulo);
      return next;
    });
  }

  async function handleSubmit() {
    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 1 || nombreLimpio.length > 40) {
      setError("El nombre debe tener entre 1 y 40 caracteres");
      return;
    }
    if (modulos.size === 0) {
      setError("Elige al menos un módulo");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await actualizar(editing.id, {
          nombre: nombreLimpio,
          modulos: [...modulos],
          ...(extenderVencimiento ? { duracion } : {}),
        });
        onClose();
      } else {
        const resultado = await crear({
          nombre: nombreLimpio,
          duracion,
          modulos: [...modulos],
        });
        onClose();
        onCreated(resultado);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  const vencimientoPreviewPara: Record<DuracionAcceso, string | undefined> = {
    hoy: vencimientos?.hoy,
    "2_dias": vencimientos?.dosDias,
    "1_semana": vencimientos?.unaSemana,
    "1_mes": vencimientos?.unMes,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar acceso de ${editing.nombre}` : "Nuevo acceso"}
      description="Un enlace y un código de 4 dígitos para que un mesero entre sin usuario ni clave."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear acceso"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            placeholder="María"
            autoFocus
          />
          {nombreDuplicado && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Ya hay un acceso vivo con este nombre. El cuadre de caja es por nombre — dos
              &quot;{nombre.trim()}&quot; a la vez se van a confundir.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">
            {editing ? "Extender vencimiento" : "Duración"}
          </p>
          {editing && (
            <label className="mb-2 flex items-center gap-2 text-[13px] text-fg-muted">
              <input
                type="checkbox"
                checked={extenderVencimiento}
                onChange={(e) => setExtenderVencimiento(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Extender el vencimiento desde ahora
            </label>
          )}
          {(!editing || extenderVencimiento) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DURACIONES.map(({ value, label }) => {
                const activo = duracion === value;
                const preview = vencimientoPreviewPara[value];
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setDuracion(value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-[var(--radius-md)] border px-2 py-2.5 text-center transition-colors duration-150",
                      activo
                        ? "border-transparent bg-active text-active-fg"
                        : "border-input bg-surface-raised text-fg hover:border-border-strong hover:bg-surface-hover",
                    )}
                  >
                    <span className="text-[13px] font-medium">{label}</span>
                    <span
                      className={cn(
                        "font-mono text-[10.5px]",
                        activo ? "text-active-fg/85" : "text-fg-subtle",
                      )}
                    >
                      {vencimientosStatus === "ready" && preview
                        ? `vence ${formatVencimientoCorto(preview)}`
                        : "…"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Módulos concedidos</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {MODULOS_ASIGNABLES.map((modulo) => {
              const Icon = ICONO_POR_MODULO.get(modulo)!;
              const checked = modulos.has(modulo);
              const hint = HINTS[modulo];
              return (
                <label
                  key={modulo}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors duration-150",
                    checked
                      ? "border-active/50 bg-active-soft"
                      : "border-border bg-surface-raised hover:bg-surface-hover",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModulo(modulo)}
                    className="mt-0.5 size-4 shrink-0 rounded border-input"
                  />
                  <Icon size={16} className="mt-0.5 shrink-0 text-fg-muted" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-fg">
                      {LABEL_POR_MODULO.get(modulo)}
                    </span>
                    {hint && <span className="block text-[11px] text-fg-subtle">{hint}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
