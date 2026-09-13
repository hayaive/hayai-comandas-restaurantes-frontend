import { create } from "zustand";
import { seedTemplates } from "./mockData";
import type { FloorPlanTemplate, RestaurantTable, TableShape, TableStatus } from "./types";

let tableSeq = 1000;
let templateSeq = 1;

function nextTableId() {
  tableSeq += 1;
  return `t-${tableSeq}`;
}

function nextTemplateId() {
  templateSeq += 1;
  return `tpl-custom-${templateSeq}`;
}

interface FloorPlanState {
  templates: FloorPlanTemplate[];
  activeTemplateId: string;
  selectedTableId: string | null;
  snapToGrid: boolean;
  gridSize: number;

  // Template operations
  selectTemplate: (templateId: string) => void;
  addTemplate: (name: string) => string;
  renameTemplate: (templateId: string, name: string) => void;
  removeTemplate: (templateId: string) => void;

  // Table operations — this is the seam a future API integration binds to.
  addTable: (shape: TableShape) => string;
  removeTable: (tableId: string) => void;
  moveTable: (tableId: string, x: number, y: number) => void;
  renameTable: (tableId: string, label: string) => void;
  setSeats: (tableId: string, seats: number) => void;
  setShape: (tableId: string, shape: TableShape) => void;
  setStatus: (tableId: string, status: TableStatus, occupantName?: string) => void;

  // Selection & canvas UX
  selectTable: (tableId: string | null) => void;
  toggleSnapToGrid: () => void;
}

function withActiveTemplate(
  templates: FloorPlanTemplate[],
  activeTemplateId: string,
  updater: (tables: RestaurantTable[]) => RestaurantTable[],
): FloorPlanTemplate[] {
  return templates.map((tpl) =>
    tpl.id === activeTemplateId ? { ...tpl, tables: updater(tpl.tables) } : tpl,
  );
}

export const useFloorPlanStore = create<FloorPlanState>((set, get) => ({
  templates: seedTemplates,
  activeTemplateId: seedTemplates[0].id,
  selectedTableId: null,
  snapToGrid: true,
  gridSize: 20,

  selectTemplate: (templateId) =>
    set({ activeTemplateId: templateId, selectedTableId: null }),

  addTemplate: (name) => {
    const id = nextTemplateId();
    const trimmed = name.trim() || "Plantilla sin nombre";
    set((state) => ({
      templates: [...state.templates, { id, name: trimmed, tables: [] }],
      activeTemplateId: id,
      selectedTableId: null,
    }));
    return id;
  },

  renameTemplate: (templateId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => ({
      templates: state.templates.map((tpl) =>
        tpl.id === templateId ? { ...tpl, name: trimmed } : tpl,
      ),
    }));
  },

  removeTemplate: (templateId) => {
    const state = get();
    if (state.templates.length <= 1) return;
    const remaining = state.templates.filter((tpl) => tpl.id !== templateId);
    const wasActive = state.activeTemplateId === templateId;
    set({
      templates: remaining,
      activeTemplateId: wasActive ? remaining[0].id : state.activeTemplateId,
      selectedTableId: wasActive ? null : state.selectedTableId,
    });
  },

  addTable: (shape) => {
    const id = nextTableId();
    const state = get();
    const activeTables =
      state.templates.find((tpl) => tpl.id === state.activeTemplateId)?.tables ?? [];
    const label = `M-${activeTables.length + 1}`;
    const newTable: RestaurantTable = {
      id,
      label,
      shape,
      x: 140 + ((activeTables.length * 47) % 900),
      y: 140 + ((activeTables.length * 83) % 480),
      size: shape === "circle" ? 90 : 78,
      seats: 4,
      status: "free",
    };
    set((s) => ({
      templates: withActiveTemplate(s.templates, s.activeTemplateId, (tables) => [
        ...tables,
        newTable,
      ]),
      selectedTableId: id,
    }));
    return id;
  },

  removeTable: (tableId) =>
    set((state) => ({
      templates: withActiveTemplate(state.templates, state.activeTemplateId, (tables) =>
        tables.filter((t) => t.id !== tableId),
      ),
      selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
    })),

  moveTable: (tableId, x, y) =>
    set((state) => ({
      templates: withActiveTemplate(state.templates, state.activeTemplateId, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, x, y } : t)),
      ),
    })),

  renameTable: (tableId, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    set((state) => ({
      templates: withActiveTemplate(state.templates, state.activeTemplateId, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, label: trimmed } : t)),
      ),
    }));
  },

  setSeats: (tableId, seats) => {
    const clamped = Math.max(1, Math.min(20, Math.round(seats)));
    set((state) => ({
      templates: withActiveTemplate(state.templates, state.activeTemplateId, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, seats: clamped } : t)),
      ),
    }));
  },

  setShape: (tableId, shape) =>
    set((state) => ({
      templates: withActiveTemplate(state.templates, state.activeTemplateId, (tables) =>
        tables.map((t) => (t.id === tableId ? { ...t, shape } : t)),
      ),
    })),

  setStatus: (tableId, status, occupantName) =>
    set((state) => ({
      templates: withActiveTemplate(state.templates, state.activeTemplateId, (tables) =>
        tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status,
                occupantName: status === "free" ? undefined : occupantName ?? t.occupantName,
              }
            : t,
        ),
      ),
    })),

  selectTable: (tableId) => set({ selectedTableId: tableId }),

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
}));

export function useActiveTemplate(): FloorPlanTemplate {
  return useFloorPlanStore((state) => {
    const found = state.templates.find((tpl) => tpl.id === state.activeTemplateId);
    return found ?? state.templates[0];
  });
}

export function useSelectedTable(): RestaurantTable | null {
  return useFloorPlanStore((state) => {
    const active = state.templates.find((tpl) => tpl.id === state.activeTemplateId);
    if (!active || !state.selectedTableId) return null;
    return active.tables.find((t) => t.id === state.selectedTableId) ?? null;
  });
}
