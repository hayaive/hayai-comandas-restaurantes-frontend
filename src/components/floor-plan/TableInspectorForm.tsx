import { useEffect, useState } from "react";
import { Circle, LogOut, MinusCircle, PlusCircle, Square, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { RestaurantTable, TableShape as TableShapeKind } from "@/lib/types";
import { STATUS_META } from "./statusMeta";
import { TableAccountPanel } from "./TableAccountPanel";

export interface TableInspectorFormProps {
  table: RestaurantTable;
  onRename: (label: string) => void;
  onSetSeats: (seats: number) => void;
  onSetShape: (shape: TableShapeKind) => void;
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
 * **El estado ya no se elige a mano, se informa.** Antes esta columna tenía
 * tres botones (libre / reservada / ocupada) y marcar "ocupada" abría la
 * comanda de la mesa. Eso dejó de ser posible: en el modelo nuevo una comanda
 * es un pedido y exige al menos una línea real, así que no hay forma honesta de
 * crear una desde aquí — ni de liberar una mesa anulando "su" comanda, porque
 * ahora puede tener varias. El estado lo deriva el servidor (`v_mesa_estado`),
 * que es quien ve las comandas vivas y la reserva sentada; la columna lo pinta
 * y, cuando la mesa está ocupada, muestra su cuenta real y deja cobrarla.
 *
 * La **forma** (redonda / cuadrada) sí sigue siendo una elección del usuario y
 * conserva el relleno activo marrón como cualquier otro control seleccionado.
 * El estado conserva su color semántico: un anfitrión tiene que leer "ocupada"
 * como rojo-ocupada, no como marrón-seleccionado.
 */
export function TableInspectorForm({
  table,
  onRename,
  onSetSeats,
  onSetShape,
  onDelete,
  onDeleteForever,
}: TableInspectorFormProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDeleteForever, setConfirmingDeleteForever] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
    setConfirmingDeleteForever(false);
  }, [table.id]);

  const statusMeta = STATUS_META[table.status];

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
        {/* Informativo, no editable: lo decide el servidor a partir de las
            comandas vivas y de la reserva sentada. */}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-[13px] font-medium",
            statusMeta.bgSoftClass,
            statusMeta.borderClass,
            statusMeta.textClass,
          )}
        >
          <span className={cn("size-2 shrink-0 rounded-full", statusMeta.dotClass)} />
          {statusMeta.label}
          {table.occupantName && (
            <span className="ml-auto min-w-0 truncate font-normal opacity-80">
              {table.occupantName}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
          Una mesa se ocupa al sentar una reserva o al enviarle un pedido, y se libera al cobrarla.
        </p>
      </div>

      {table.status === "occupied" && (
        <div>
          <FieldLabel>Cuenta de la mesa</FieldLabel>
          <TableAccountPanel
            mesaId={table.id}
            mesaEtiqueta={table.label}
            clienteNombre={table.occupantName}
          />
        </div>
      )}

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
