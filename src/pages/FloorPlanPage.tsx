import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Armchair, CheckCircle2, Info, List, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useEditingTemplate,
  useFloorPlanBootstrap,
  useFloorPlanStore,
  useSelectedTable,
} from "@/lib/useFloorPlanStore";
import { BottomToolbar } from "@/components/floor-plan/BottomToolbar";
import { FloorPlanCanvas } from "@/components/floor-plan/FloorPlanCanvas";
import { TableCardsPicker } from "@/components/floor-plan/TableCardsPicker";
import { TableInspectorPanel } from "@/components/floor-plan/TableInspectorPanel";
import { MobileTableSheet } from "@/components/floor-plan/MobileTableSheet";
import { TemplateSwitcher } from "@/components/floor-plan/TemplateSwitcher";
import { STATUS_META, STATUS_ORDER } from "@/components/floor-plan/statusMeta";
import { cn } from "@/lib/cn";

type FloorPlanView = "map" | "list";

const VIEW_STORAGE_KEY = "hayai-floorplan-view";

/**
 * Mismo corte `md` (768px) que ya usa esta pantalla para decidir aside vs.
 * bottom-sheet (`TableInspectorPanel`, `MobileTableSheet`) — reutilizarlo acá
 * evita que "desktop" signifique dos anchos distintos dentro de la misma
 * página.
 */
const DESKTOP_QUERY = "(min-width: 768px)";

function getStoredView(): FloorPlanView | null {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "map" || stored === "list" ? stored : null;
  } catch {
    // Storage no disponible (modo privado, cuota llena, etc.) — se cae al
    // default por viewport, calculado por quien llama a este helper.
    return null;
  }
}

/**
 * La preferencia lista/aérea es POR DISPOSITIVO, no por cuenta ni por
 * restaurante: la tablet del host en la entrada quiere el mapa fijo sobre el
 * mostrador, y el teléfono del mesero en el salón quiere la lista — son el
 * mismo restaurante y la misma sesión, así que guardarlo en el backend
 * mezclaría ambas preferencias entre sí. `localStorage` ya vive por
 * navegador/dispositivo, que es exactamente el corte que hace falta.
 *
 * Sin preferencia guardada, el default se decide una sola vez con el
 * viewport que hay al montar: mobile arranca en lista (el mapa es incómodo
 * con el pulgar — el problema que pide resolver este cambio), desktop
 * arranca en aérea (el uso de siempre, y ahí sí sobra ancho). Una vez el
 * usuario elige a mano, esa elección manda y no se recalcula por resize.
 */
function useFloorPlanView(): [FloorPlanView, (next: FloorPlanView) => void] {
  const [view, setViewState] = useState<FloorPlanView>(() => {
    const stored = getStoredView();
    if (stored) return stored;
    if (typeof window === "undefined") return "map";
    return window.matchMedia(DESKTOP_QUERY).matches ? "map" : "list";
  });

  function setView(next: FloorPlanView) {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Igual aplica para esta sesión; sólo no sobrevive a un refresh.
    }
  }

  return [view, setView];
}

/**
 * Segmented control lista/aérea. Mismo patrón visual que `PaperWidthToggle`
 * en `FacturaMesaModal` (radiogroup de botones, no un <select>) — es el
 * precedente de este repo para "elegir una de dos opciones, con las dos
 * siempre visibles" en vez de esconder la opción no elegida en un menú.
 */
function ViewToggle({ value, onChange }: { value: FloorPlanView; onChange: (next: FloorPlanView) => void }) {
  const options: { value: FloorPlanView; label: string; icon: ReactNode }[] = [
    { value: "list", label: "Lista", icon: <List size={14} /> },
    { value: "map", label: "Aérea", icon: <MapIcon size={14} /> },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Vista del plano"
      className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-raised p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
            value === option.value ? "bg-active text-active-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FloorPlanPage() {
  useFloorPlanBootstrap();
  const [view, setView] = useFloorPlanView();

  const templates = useFloorPlanStore((state) => state.templates);
  const editingTemplateId = useFloorPlanStore((state) => state.editingTemplateId);
  const activeTemplateId = useFloorPlanStore((state) => state.activeTemplateId);
  const gridSize = useFloorPlanStore((state) => state.gridSize);
  const selectedTableId = useFloorPlanStore((state) => state.selectedTableId);
  const status = useFloorPlanStore((state) => state.status);
  const error = useFloorPlanStore((state) => state.error);
  const notice = useFloorPlanStore((state) => state.notice);

  const load = useFloorPlanStore((state) => state.load);
  const clearError = useFloorPlanStore((state) => state.clearError);
  const clearNotice = useFloorPlanStore((state) => state.clearNotice);
  const selectTemplate = useFloorPlanStore((state) => state.selectTemplate);
  const activateTemplate = useFloorPlanStore((state) => state.activateTemplate);
  const addTemplate = useFloorPlanStore((state) => state.addTemplate);
  const removeTemplate = useFloorPlanStore((state) => state.removeTemplate);
  const addTable = useFloorPlanStore((state) => state.addTable);
  const moveTable = useFloorPlanStore((state) => state.moveTable);
  const removeTable = useFloorPlanStore((state) => state.removeTable);
  const deleteTablePermanently = useFloorPlanStore((state) => state.deleteTablePermanently);
  const renameTable = useFloorPlanStore((state) => state.renameTable);
  const setSeats = useFloorPlanStore((state) => state.setSeats);
  const setShape = useFloorPlanStore((state) => state.setShape);
  const selectTable = useFloorPlanStore((state) => state.selectTable);

  const editingTemplate = useEditingTemplate();
  const selectedTable = useSelectedTable();

  const statusCounts = useMemo(() => {
    const counts = { free: 0, reserved: 0, occupied: 0 } as Record<string, number>;
    for (const table of editingTemplate.tables) counts[table.status] += 1;
    return counts;
  }, [editingTemplate.tables]);

  const isEditingActive = editingTemplateId !== "" && editingTemplateId === activeTemplateId;

  if (status === "loading" && templates.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-fg-muted">Cargando el plano del salón…</p>
      </div>
    );
  }

  if (status === "error" && templates.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <EmptyState
          icon={<AlertTriangle size={26} />}
          title="No se pudo cargar el plano"
          description={error ?? "Ocurrió un error inesperado."}
          action={<Button onClick={() => void load()}>Reintentar</Button>}
        />
      </div>
    );
  }

  if (status === "ready" && templates.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <EmptyState
          icon={<Armchair size={26} />}
          title="Este salón todavía no tiene distribuciones"
          description="Crea una plantilla desde el backend o pide a un administrador que configure el salón para empezar a dibujar el plano."
          action={<Button onClick={() => void load()}>Recargar</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Mesas"
        className="px-3 sm:px-5"
        left={
          <TemplateSwitcher
            templates={templates}
            activeTemplateId={editingTemplateId}
            onSelect={selectTemplate}
            onCreate={(name) => void addTemplate(name)}
            onDelete={(id) => void removeTemplate(id)}
          />
        }
        actions={
          <>
            <ViewToggle value={view} onChange={setView} />

            {isEditingActive ? (
              <span className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-status-free/30 bg-status-free-soft px-2.5 py-1 text-[12px] font-medium text-status-free-fg">
                <CheckCircle2 size={14} />
                En uso ahora
              </span>
            ) : (
              <Button variant="primary" size="sm" onClick={() => void activateTemplate(editingTemplateId)}>
                Usar esta distribución
              </Button>
            )}

            <ul className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-fg-muted sm:gap-3 sm:text-[12px]">
              {STATUS_ORDER.map((tableStatus) => (
                <li key={tableStatus} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className={`size-2 rounded-full ${STATUS_META[tableStatus].dotClass}`} />
                  {statusCounts[tableStatus]} {STATUS_META[tableStatus].label.toLowerCase()}
                </li>
              ))}
            </ul>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex shrink-0 items-start gap-2 border-b border-danger/30 bg-danger-soft px-5 py-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={clearError} className="shrink-0 font-medium underline">
            Cerrar
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="flex shrink-0 items-start gap-2 border-b border-border bg-surface-sunken px-5 py-3 text-sm text-fg-muted">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={clearNotice} className="shrink-0 font-medium underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {view === "map" ? (
            <FloorPlanCanvas
              tables={editingTemplate.tables}
              selectedTableId={selectedTableId}
              gridSize={gridSize}
              onSelectTable={selectTable}
              onMoveTable={moveTable}
            />
          ) : (
            // Vista lista: mismo fondo/padding que `FloorPlanCanvas` para que
            // cambiar de vista no salte de layout. `TableCardsPicker` con
            // `selectAny` abre el mismo inspector/`MobileTableSheet` que tocar
            // una mesa en el mapa (comparten `selectTable` del store) — sólo
            // cambia cómo se elige la mesa, no qué pasa después.
            <div className="flex-1 overflow-y-auto bg-bg-canvas p-3 sm:p-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                <p className="text-[12px] text-fg-subtle">
                  La lista no mueve mesas de sitio — para reordenar el salón, cambia a la vista
                  aérea.
                </p>
                {editingTemplate.tables.length === 0 ? (
                  <p className="py-12 text-center text-sm text-fg-muted">
                    Esta distribución todavía no tiene mesas. Usa el botón de abajo para agregar
                    la primera.
                  </p>
                ) : (
                  <TableCardsPicker
                    tables={editingTemplate.tables}
                    selectedTableId={selectedTableId}
                    onPick={(table) => selectTable(table.id)}
                    selectAny
                  />
                )}
              </div>
            </div>
          )}

          <BottomToolbar onAddTable={(shape) => void addTable(shape)} />
        </div>

        <TableInspectorPanel
          table={selectedTable}
          onRename={(label) => selectedTable && renameTable(selectedTable.id, label)}
          onSetSeats={(seats) => selectedTable && setSeats(selectedTable.id, seats)}
          onSetShape={(shape) => selectedTable && setShape(selectedTable.id, shape)}
          onDelete={() => {
            if (selectedTable) void removeTable(selectedTable.id);
          }}
          onDeleteForever={() => {
            if (selectedTable) void deleteTablePermanently(selectedTable.id);
          }}
        />
      </div>

      <MobileTableSheet
        table={selectedTable}
        onClose={() => selectTable(null)}
        onRename={(label) => selectedTable && renameTable(selectedTable.id, label)}
        onSetSeats={(seats) => selectedTable && setSeats(selectedTable.id, seats)}
        onSetShape={(shape) => selectedTable && setShape(selectedTable.id, shape)}
        onDelete={() => {
          if (selectedTable) void removeTable(selectedTable.id);
        }}
        onDeleteForever={() => {
          if (selectedTable) void deleteTablePermanently(selectedTable.id);
        }}
      />
    </div>
  );
}
