"use client";

/**
 * App state (Zustand). Settings (stop-words, synonyms, phrases, URL template,
 * tuning) persist to localStorage — the only persistence in the app.
 * Ticket data and filters are session-only.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, DEFAULT_URL_TEMPLATE } from "./defaults";
import { EMPTY_FILTERS, pruneOrphanSelections } from "./filters";
import type {
  FilterColumn,
  Filters,
  GraphResult,
  GraphSettings,
  Ticket,
} from "./types";

export type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

interface DataState {
  tickets: Ticket[];
  sourceName: string;
  warnings: string[];
  filters: Filters;
  graph: GraphResult | null;
  computing: boolean;
  selection: Selection;
  hoveredNode: string | null;

  setData(tickets: Ticket[], sourceName: string, warnings: string[]): void;
  appendData(tickets: Ticket[], sourceName: string, warnings: string[]): void;
  clearData(): void;
  setFilterValues(field: FilterColumn, values: string[]): void;
  setDateRange(from?: string, to?: string): void;
  resetFilters(): void;
  setGraph(graph: GraphResult | null): void;
  setComputing(computing: boolean): void;
  setSelection(selection: Selection): void;
  setHoveredNode(id: string | null): void;
}

export const useDataStore = create<DataState>((set, get) => ({
  tickets: [],
  sourceName: "",
  warnings: [],
  filters: EMPTY_FILTERS,
  graph: null,
  computing: false,
  selection: null,
  hoveredNode: null,

  setData: (tickets, sourceName, warnings) =>
    set({ tickets, sourceName, warnings, filters: EMPTY_FILTERS, selection: null, graph: null }),
  appendData: (tickets, sourceName, warnings) => {
    const prev = get();
    const seen = new Set(prev.tickets.map((t) => t.ticket_id));
    const merged = [...prev.tickets, ...tickets.filter((t) => !seen.has(t.ticket_id))];
    set({
      tickets: merged,
      sourceName: prev.sourceName ? `${prev.sourceName} + ${sourceName}` : sourceName,
      warnings: [...prev.warnings, ...warnings],
      filters: pruneOrphanSelections(merged, prev.filters),
      selection: null,
    });
  },
  clearData: () =>
    set({
      tickets: [],
      sourceName: "",
      warnings: [],
      filters: EMPTY_FILTERS,
      graph: null,
      selection: null,
    }),
  setFilterValues: (field, values) => {
    const { tickets, filters } = get();
    const next: Filters = {
      ...filters,
      values: { ...filters.values, [field]: values.length > 0 ? values : undefined },
    };
    set({ filters: pruneOrphanSelections(tickets, next), selection: null });
  },
  setDateRange: (from, to) =>
    set((s) => ({ filters: { ...s.filters, openedFrom: from, openedTo: to }, selection: null })),
  resetFilters: () => set({ filters: EMPTY_FILTERS, selection: null }),
  setGraph: (graph) => set({ graph }),
  setComputing: (computing) => set({ computing }),
  setSelection: (selection) => set({ selection }),
  setHoveredNode: (hoveredNode) => set({ hoveredNode }),
}));

interface SettingsState {
  settings: GraphSettings;
  urlTemplate: string;
  physics: boolean;

  setSettings(update: Partial<GraphSettings>): void;
  setPipeline(update: Partial<GraphSettings["pipeline"]>): void;
  setCooccurrence(update: Partial<GraphSettings["cooccurrence"]>): void;
  setClustering(update: Partial<GraphSettings["clustering"]>): void;
  setUrlTemplate(urlTemplate: string): void;
  setPhysics(physics: boolean): void;
  resetSettings(): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      urlTemplate: DEFAULT_URL_TEMPLATE,
      physics: true,

      setSettings: (update) => set((s) => ({ settings: { ...s.settings, ...update } })),
      setPipeline: (update) =>
        set((s) => ({
          settings: { ...s.settings, pipeline: { ...s.settings.pipeline, ...update } },
        })),
      setCooccurrence: (update) =>
        set((s) => ({
          settings: { ...s.settings, cooccurrence: { ...s.settings.cooccurrence, ...update } },
        })),
      setClustering: (update) =>
        set((s) => ({
          settings: { ...s.settings, clustering: { ...s.settings.clustering, ...update } },
        })),
      setUrlTemplate: (urlTemplate) => set({ urlTemplate }),
      setPhysics: (physics) => set({ physics }),
      resetSettings: () =>
        set({ settings: DEFAULT_SETTINGS, urlTemplate: DEFAULT_URL_TEMPLATE, physics: true }),
    }),
    {
      name: "ticket-network-settings",
      version: 1,
    }
  )
);
