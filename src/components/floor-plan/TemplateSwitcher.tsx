import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { FloorPlanTemplate } from "@/lib/types";

interface TemplateSwitcherProps {
  templates: FloorPlanTemplate[];
  activeTemplateId: string;
  onSelect: (templateId: string) => void;
  onCreate: (name: string) => void;
  onDelete: (templateId: string) => void;
}

export function TemplateSwitcher({
  templates,
  activeTemplateId,
  onSelect,
  onCreate,
  onDelete,
}: TemplateSwitcherProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<FloorPlanTemplate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function startCreating() {
    setCreating(true);
    setDraftName("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    const trimmed = draftName.trim();
    if (trimmed) onCreate(trimmed);
    setCreating(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCreating(false);
    }
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onDelete(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {templates.map((template) => {
        const active = template.id === activeTemplateId;
        return (
          <div key={template.id} className="group relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onSelect(template.id)}
              aria-pressed={active}
              className={cn(
                "whitespace-nowrap rounded-[var(--radius-md)] px-3.5 py-2 text-[13px] font-medium",
                "transition-colors duration-150",
                // CLIENT OVERRIDE: the template currently being edited is the
                // active one, so it takes the brown fill.
                active
                  ? "bg-active text-active-fg"
                  : "bg-surface-hover text-fg-muted hover:bg-border hover:text-fg",
              )}
            >
              {template.name}
              <span className="ml-1.5 font-mono text-[11px] opacity-70">
                {template.tables.length}
              </span>
            </button>
            {templates.length > 1 && (
              <button
                type="button"
                onClick={() => setPendingDelete(template)}
                aria-label={`Eliminar plantilla ${template.name}`}
                title={`Eliminar plantilla ${template.name}`}
                className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-subtle opacity-0 transition-opacity duration-150 hover:bg-danger-soft hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}

      {creating ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder="Nombre de la plantilla"
          className="h-9 w-44 shrink-0 rounded-[var(--radius-md)] border border-accent bg-surface px-3.5 text-[13px] text-fg outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={startCreating}
          aria-label="Nueva plantilla"
          title="Nueva plantilla"
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-strong text-fg-subtle transition-colors duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent"
        >
          <Plus size={15} />
        </button>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={`Eliminar "${pendingDelete?.name ?? ""}"`}
        description={`Se perderán sus ${pendingDelete?.tables.length ?? 0} mesas y no se puede deshacer.`}
        footer={
          <>
            <Button size="sm" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Eliminar plantilla
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          Esta acción no afecta a las demás plantillas guardadas.
        </p>
      </Modal>
    </div>
  );
}
