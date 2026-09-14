import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { MobileNewTemplateSheet } from "./MobileNewTemplateSheet";
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
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null;

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
    <>
    {/* Desktop / tablet (≥ md): the pill row, unchanged — horizontal scroll
        here is fine on a pointer-driven wide surface. Below `md` this whole
        row would scroll sideways with enough plantillas, which the client
        explicitly does not want on a phone — see the `md:hidden` select
        below instead. */}
    <div className="hidden items-center gap-1 overflow-x-auto md:flex">
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
    </div>

    {/* Mobile (< md): a select to switch between organizaciones de mesas
        instead of a row of pills that would scroll sideways, plus a separate
        "nueva" button that opens `MobileNewTemplateSheet` — same bottom-sheet
        language as `MobileMoreSheet`/`MobileTableSheet`. Deleting stays the
        icon + confirmation `Modal` from the desktop row, acting on whichever
        plantilla the select currently shows. */}
    <div className="flex min-w-0 flex-1 items-center gap-1.5 md:hidden">
      <Select
        value={activeTemplateId}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="Organización de mesas"
        fieldClassName="min-w-0 flex-1"
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.tables.length})
          </option>
        ))}
      </Select>
      <IconButton
        icon={<Plus size={15} />}
        label="Nueva organización de mesas"
        title="Nueva organización de mesas"
        variant="outline"
        onClick={() => setMobileCreateOpen(true)}
      />
      {templates.length > 1 && activeTemplate && (
        <IconButton
          icon={<Trash2 size={14} />}
          label={`Eliminar organización ${activeTemplate.name}`}
          title={`Eliminar organización ${activeTemplate.name}`}
          variant="outline"
          onClick={() => setPendingDelete(activeTemplate)}
        />
      )}
    </div>

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

    <MobileNewTemplateSheet
      open={mobileCreateOpen}
      onClose={() => setMobileCreateOpen(false)}
      onCreate={onCreate}
    />
    </>
  );
}
