import { useEffect, useState } from "react";
import { Circle, MinusCircle, PlusCircle, Square, Trash, Users } from "@phosphor-icons/react";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import type { RestaurantTable, TableShape as TableShapeKind, TableStatus } from "@/lib/types";
import { STATUS_META, STATUS_ORDER } from "./statusMeta";

interface TableInspectorPanelProps {
  table: RestaurantTable | null;
  onRename: (label: string) => void;
  onSetSeats: (seats: number) => void;
  onSetShape: (shape: TableShapeKind) => void;
  onSetStatus: (status: TableStatus, occupantName?: string) => void;
  onDelete: () => void;
}

export function TableInspectorPanel({
  table,
  onRename,
  onSetSeats,
  onSetShape,
  onSetStatus,
  onDelete,
}: TableInspectorPanelProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [table?.id]);

  if (!table) {
    return (
      <aside className="flex w-[280px] shrink-0 flex-col border-l border-border bg-surface">
        <EmptyState
          icon={<Users size={24} weight="duotone" />}
          title="Ninguna mesa seleccionada"
          description="Toca una mesa en el plano para editar su número, sillas y estado."
        />
      </aside>
    );
  }

  const occupantVisible = table.status !== "free";

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-surface px-4 py-4">
      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Mesa seleccionada
        </span>
        <Input
          label="Número / etiqueta"
          value={table.label}
          onChange={(event) => onRename(event.target.value)}
          maxLength={16}
        />
      </div>

      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Forma
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSetShape("circle")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border py-2 text-[13px] font-medium transition-colors duration-150",
              table.shape === "circle"
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface-raised text-fg-muted hover:bg-surface-hover",
            )}
          >
            <Circle size={16} weight="bold" /> Redonda
          </button>
          <button
            type="button"
            onClick={() => onSetShape("square")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border py-2 text-[13px] font-medium transition-colors duration-150",
              table.shape === "square"
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface-raised text-fg-muted hover:bg-surface-hover",
            )}
          >
            <Square size={16} weight="bold" /> Cuadrada
          </button>
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Capacidad
        </span>
        <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-2 py-1.5">
          <button
            type="button"
            aria-label="Quitar silla"
            disabled={table.seats <= 1}
            onClick={() => onSetSeats(table.seats - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30"
          >
            <MinusCircle size={20} />
          </button>
          <span className="flex-1 text-center font-mono text-[15px] font-semibold text-fg">
            {table.seats}
          </span>
          <button
            type="button"
            aria-label="Agregar silla"
            disabled={table.seats >= 20}
            onClick={() => onSetSeats(table.seats + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-fg-muted transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Estado
        </span>
        <div className="flex flex-col gap-1.5">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const active = table.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onSetStatus(status, table.occupantName)}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[13px] font-medium transition-colors duration-150",
                  active
                    ? cn(meta.bgSoftClass, meta.borderClass, meta.textClass)
                    : "border-border bg-surface-raised text-fg-muted hover:bg-surface-hover",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
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

      <div className="mt-auto border-t border-border pt-4">
        {confirmingDelete ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-fg-muted">
              ¿Eliminar la mesa <span className="font-medium text-fg">{table.label}</span>?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-[var(--radius-sm)] border border-border bg-surface-raised py-2 text-[13px] font-medium text-fg-muted hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 rounded-[var(--radius-sm)] bg-danger py-2 text-[13px] font-medium text-white hover:brightness-110"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger hover:text-white"
          >
            <Trash size={15} /> Eliminar mesa
          </button>
        )}
      </div>
    </aside>
  );
}
