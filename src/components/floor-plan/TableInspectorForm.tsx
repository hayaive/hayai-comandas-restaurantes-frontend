import { useEffect, useState } from "react";
import { Circle, LogOut, MinusCircle, PlusCircle, Square, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { RestaurantTable, TableShape as TableShapeKind, TableStatus } from "@/lib/types";
import { STATUS_META, STATUS_ORDER } from "./statusMeta";

export interface TableInspectorFormProps {
  table: RestaurantTable;
  onRename: (label: string) => void;
  onSetSeats: (seats: number) => void;
  onSetShape: (shape: TableShapeKind) => void;
  onSetStatus: (status: TableStatus, occupantName?: string) => void;
  /** Saca la mesa de ESTA distribución. Su identidad y su histórico sobreviven. */
  onDelete: () => void;
  /**
   * Borra la IDENTIDAD de la mesa (CONTRACT.md §3.6): desaparece de TODAS
   * las distribuciones y libera su número para que una mesa nueva pueda
   * usarlo. Irreversible — a diferencia de `onDelete`, no hay forma de volver
   * a dibujarla igual.
   */
  onDeleteForever: () => void;
}

/**
 * The actual "edit this table" form — shared by the desktop/tablet side
 * column (`TableInspectorPanel`) and the mobile bottom sheet
 * (`MobileTableSheet`), so both stay in sync with a single implementation.
 *
 * Two different kinds of "active" live on this form, and they are styled
 * differently on purpose:
 *
 * - **Shape** (round / square) is a *choice the user made*, so the selected
 *   one takes the brown active fill like every other selected control in the
 *   product.
 * - **Status** (libre / reservada / ocupada) is a *fact about the world*. It
 *   keeps its own semantic colour, because a host scanning the panel has to
 *   read "this table is occupied" as occupied-red, not as selected-brown.
 *   Overriding it would make the three states indistinguishable at a glance,
 *   which is the one thing the status palette exists to prevent. The selected
 *   status is marked by its ring instead.
 */
export function TableInspectorForm({
  table,
  onRename,
  onSetSeats,
  onSetShape,
  onSetStatus,
  onDelete,
  onDeleteForever,
}: TableInspectorFormProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDeleteForever, setConfirmingDeleteForever] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
    setConfirmingDeleteForever(false);
  }, [table.id]);

  const occupantVisible = table.status !== "free";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <FieldLabel>Mesa seleccionada</FieldLabel>
        <Input
          label="Número / etiqueta"
          value={table.label}
          onChange={(event) => onRename(event.target.value)}
          maxLength={16}
        />
      </div>

      <div>
        <FieldLabel>Forma</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "circle", label: "Redonda", Icon: Circle },
              { value: "square", label: "Cuadrada", Icon: Square },
            ] as const
          ).map(({ value, label, Icon }) => {
            const active = table.shape === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onSetShape(value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-[var(--radius-md)] border py-2.5 text-[13px] font-medium",
                  "transition-colors duration-150",
                  active
                    ? "border-transparent bg-active text-active-fg"
                    : "border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:bg-surface-hover",
                )}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Capacidad</FieldLabel>
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised px-2 py-1.5">
          <button
            type="button"
            aria-label="Quitar silla"
            disabled={table.seats <= 1}
            onClick={() => onSetSeats(table.seats - 1)}
            className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-30"
          >
            <MinusCircle size={20} />
          </button>
          <span className="flex-1 text-center font-mono text-base font-semibold tabular-nums text-fg">
            {table.seats}
          </span>
          <button
            type="button"
            aria-label="Agregar silla"
            disabled={table.seats >= 20}
            onClick={() => onSetSeats(table.seats + 1)}
            className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-30"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      </div>

      <div>
        <FieldLabel>Estado</FieldLabel>
        <div className="flex flex-col gap-1.5">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const active = table.status === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => onSetStatus(status, table.occupantName)}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-[13px] font-medium",
                  "transition-colors duration-150",
                  active
                    ? cn(meta.bgSoftClass, meta.borderClass, meta.textClass, "ring-2 ring-active")
                    : "border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:bg-surface-hover",
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", meta.dotClass)} />
                {meta.label}
              </button>
            );
          })}
        </div>

        {occupantVisible && (
          <div className="mt-3">
            <Input
              label="Nombre del cliente"
              placeholder="Ej. Familia Restrepo"
              value={table.occupantName ?? ""}
              onChange={(event) => onSetStatus(table.status, event.target.value)}
              maxLength={40}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border pt-5">
        {confirmingDelete ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-fg-muted">
              ¿Quitar la mesa <span className="font-medium text-fg">{table.label}</span> de esta
              distribución? Su número y su histórico se conservan; puedes volver a dibujarla en
              cualquier plano.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={onDelete}>
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft py-2.5 text-[13px] font-medium text-danger transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut size={15} /> Quitar del plano
          </button>
        )}
      </div>

      <div className="border-t border-border pt-5">
        {confirmingDeleteForever ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-fg-muted">
              ¿Eliminar la mesa <span className="font-medium text-fg">{table.label}</span>{" "}
              definitivamente? Desaparece de <span className="font-medium text-fg">todas</span>{" "}
              las distribuciones y su número queda libre para una mesa nueva. No se puede
              deshacer.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setConfirmingDeleteForever(false)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={onDeleteForever}>
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDeleteForever(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] py-2 text-[12px] font-medium text-fg-subtle transition-colors hover:text-danger"
          >
            <Trash2 size={13} /> Eliminar mesa definitivamente
          </button>
        )}
      </div>
    </div>
  );
}

/** The small caps label above each control group. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
      {children}
    </span>
  );
}
