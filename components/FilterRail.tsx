"use client";

import { useState } from "react";
import { communityColor } from "@/lib/defaults";
import { edgesCsv, downloadFile, graphJson, incidentsCsv, nodesCsv } from "@/lib/exports";
import { countActiveFilters, optionsForField } from "@/lib/filters";
import { useDataStore, useSettingsStore } from "@/lib/store";
import {
  FILTER_COLUMNS,
  TEXT_COLUMNS,
  type FilterColumn,
  type TextColumn,
  type Ticket,
} from "@/lib/types";
import { MultiSelect } from "./MultiSelect";
import { SettingsDialog } from "./SettingsDialog";

const FILTER_LABELS: Record<FilterColumn, string> = {
  business_unit: "Business unit",
  location: "Location",
  country: "Country",
  state: "State / region",
  category: "Category",
  assignment_group: "Assignment group",
  priority: "Priority",
  status: "Status",
};

const TEXT_LABELS: Record<TextColumn, string> = {
  short_description: "Short description",
  work_notes: "Work notes",
  close_notes: "Close notes",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(v: number): void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-16 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-right tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
      />
    </label>
  );
}

export function FilterRail({ filteredTickets }: { filteredTickets: Ticket[] }) {
  const tickets = useDataStore((s) => s.tickets);
  const filters = useDataStore((s) => s.filters);
  const graph = useDataStore((s) => s.graph);
  const setFilterValues = useDataStore((s) => s.setFilterValues);
  const setDateRange = useDataStore((s) => s.setDateRange);
  const resetFilters = useDataStore((s) => s.resetFilters);
  const clearData = useDataStore((s) => s.clearData);

  const settings = useSettingsStore((s) => s.settings);
  const setPipeline = useSettingsStore((s) => s.setPipeline);
  const setCooccurrence = useSettingsStore((s) => s.setCooccurrence);
  const setClustering = useSettingsStore((s) => s.setClustering);
  const physics = useSettingsStore((s) => s.physics);
  const setPhysics = useSettingsStore((s) => s.setPhysics);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const active = countActiveFilters(filters);
  const co = settings.cooccurrence;
  const pl = settings.pipeline;

  function toggleTextColumn(col: TextColumn) {
    const cur = pl.textColumns;
    const next = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col];
    if (next.length === 0) return; // keep at least one text source
    setPipeline({ textColumns: next });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-zinc-300 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Section title={`Filters${active > 0 ? ` · ${active} active` : ""}`}>
        {tickets.length === 0 && (
          <p className="text-xs text-zinc-400">Load a CSV to enable filtering.</p>
        )}
        {tickets.length > 0 && (
          <>
            {FILTER_COLUMNS.map((field) => (
              <MultiSelect
                key={field}
                label={FILTER_LABELS[field]}
                options={optionsForField(tickets, filters, field)}
                selected={filters.values[field] ?? []}
                onChange={(values) => setFilterValues(field, values)}
              />
            ))}
            <div className="flex items-center gap-1 pt-1 text-xs">
              <span className="w-10 shrink-0 text-zinc-500 dark:text-zinc-400">Opened</span>
              <input
                type="date"
                value={filters.openedFrom ?? ""}
                onChange={(e) => setDateRange(e.target.value || undefined, filters.openedTo)}
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-800"
              />
              <span className="text-zinc-400">–</span>
              <input
                type="date"
                value={filters.openedTo ?? ""}
                onChange={(e) => setDateRange(filters.openedFrom, e.target.value || undefined)}
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <button
              onClick={resetFilters}
              disabled={active === 0}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Reset filters
            </button>
          </>
        )}
      </Section>

      <Section title="Text sources">
        {TEXT_COLUMNS.map((col) => (
          <label key={col} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={pl.textColumns.includes(col)}
              onChange={() => toggleTextColumn(col)}
              className="accent-blue-600"
            />
            {TEXT_LABELS[col]}
          </label>
        ))}
      </Section>

      <Section title="Network tuning">
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Co-occurrence scope</span>
          <select
            value={co.scope}
            onChange={(e) => setCooccurrence({ scope: e.target.value as "document" | "window" })}
            className="rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="document">ticket</option>
            <option value="window">window</option>
          </select>
        </label>
        {co.scope === "window" && (
          <NumberField
            label="Window size"
            value={co.windowSize}
            min={2}
            max={50}
            onChange={(v) => setCooccurrence({ windowSize: v })}
          />
        )}
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Edge weighting</span>
          <select
            value={co.weighting}
            onChange={(e) => setCooccurrence({ weighting: e.target.value as "count" | "pmi" })}
            className="rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="count">count</option>
            <option value="pmi">PMI</option>
          </select>
        </label>
        <NumberField label="Min term frequency" value={co.minFreq} min={1} max={100}
          onChange={(v) => setCooccurrence({ minFreq: v })} />
        <NumberField label="Min edge count" value={co.minEdge} min={1} max={100}
          onChange={(v) => setCooccurrence({ minEdge: v })} />
        <NumberField label="Max terms" value={co.maxTerms} min={10} max={500} step={10}
          onChange={(v) => setCooccurrence({ maxTerms: v })} />
        <NumberField label="Louvain resolution" value={settings.clustering.resolution}
          min={0.2} max={3} step={0.1}
          onChange={(v) => setClustering({ resolution: v })} />
        <label className="flex items-center gap-2 pt-1 text-xs">
          <input
            type="checkbox"
            checked={pl.phrasesEnabled}
            onChange={(e) => setPipeline({ phrasesEnabled: e.target.checked })}
            className="accent-blue-600"
          />
          Keep multi-word phrases
        </label>
        {pl.phrasesEnabled && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={pl.autoPhrases}
              onChange={(e) => setPipeline({ autoPhrases: e.target.checked })}
              className="accent-blue-600"
            />
            Auto-detect frequent bigrams
          </label>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={physics}
            onChange={(e) => setPhysics(e.target.checked)}
            className="accent-blue-600"
          />
          Layout physics
        </label>
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Stop-words, synonyms &amp; phrases…
        </button>
      </Section>

      {graph && (
        <Section title="Clusters">
          <div className="space-y-1">
            {graph.communities.slice(0, 12).map((c) => (
              <div key={c.id} className="flex items-start gap-1.5 text-xs">
                <span
                  className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: communityColor(c.id) }}
                />
                <span className="min-w-0">
                  <span className="font-medium">{c.terms[0]?.label ?? `cluster ${c.id}`}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {" "}
                    · {c.size} terms
                    {c.terms.length > 1 &&
                      `: ${c.terms.slice(1, 5).map((t) => t.label).join(", ")}${c.terms.length > 5 ? "…" : ""}`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Export">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            disabled={!graph}
            onClick={() => graph && downloadFile(nodesCsv(graph), "nodes.csv", "text/csv")}
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Nodes CSV
          </button>
          <button
            disabled={!graph}
            onClick={() => graph && downloadFile(edgesCsv(graph), "edges.csv", "text/csv")}
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Edges CSV
          </button>
          <button
            disabled={filteredTickets.length === 0}
            onClick={() =>
              downloadFile(incidentsCsv(filteredTickets), "incidents_filtered.csv", "text/csv")
            }
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Incidents CSV
          </button>
          <button
            disabled={!graph}
            onClick={() => graph && downloadFile(graphJson(graph), "graph.json", "application/json")}
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Graph JSON
          </button>
        </div>
        {tickets.length > 0 && (
          <button
            onClick={clearData}
            className="mt-1 w-full rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Clear dataset
          </button>
        )}
      </Section>

      {graph && (
        <div className="px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          {graph.stats.keptTerms}/{graph.stats.totalTerms} terms ·{" "}
          {graph.stats.keptEdges}/{graph.stats.totalEdges} edges
          {graph.stats.detectedPhrases.length > 0 &&
            ` · ${graph.stats.detectedPhrases.length} auto-phrases`}
        </div>
      )}

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}
