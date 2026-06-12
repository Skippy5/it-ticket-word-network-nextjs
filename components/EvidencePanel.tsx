"use client";

/**
 * Right-hand drill-in panel: the incidents behind a clicked node (term) or
 * edge (co-occurring term pair). Incident IDs are copyable and optionally
 * linked via the configurable URL template.
 */
import { useMemo, useState } from "react";
import { ticketUrl } from "@/lib/drilldown";
import { compilePipeline } from "@/lib/pipeline";
import { useDataStore, useSettingsStore } from "@/lib/store";
import type { Ticket } from "@/lib/types";
import { highlightTerms } from "./highlight";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      title="Copy incident number"
      className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

export function EvidencePanel({ filteredTickets }: { filteredTickets: Ticket[] }) {
  const graph = useDataStore((s) => s.graph);
  const selection = useDataStore((s) => s.selection);
  const setSelection = useDataStore((s) => s.setSelection);
  const urlTemplate = useSettingsStore((s) => s.urlTemplate);
  const pipelineOptions = useSettingsStore((s) => s.settings.pipeline);

  const ticketsById = useMemo(() => {
    const map = new Map<string, Ticket>();
    for (const t of filteredTickets) map.set(t.ticket_id, t);
    return map;
  }, [filteredTickets]);

  const compiled = useMemo(() => compilePipeline(pipelineOptions), [pipelineOptions]);

  const content = useMemo(() => {
    if (!graph || !selection) return null;
    if (selection.kind === "node") {
      const node = graph.nodes.find((n) => n.id === selection.id);
      if (!node) return null;
      return {
        title: node.label,
        subtitle: `term · ${node.ticketIds.length} incident${node.ticketIds.length === 1 ? "" : "s"}`,
        targets: [node.id],
        ticketIds: node.ticketIds,
      };
    }
    const edge = graph.edges.find((e) => e.id === selection.id);
    if (!edge) return null;
    const sourceLabel = graph.nodes.find((n) => n.id === edge.source)?.label ?? edge.source;
    const targetLabel = graph.nodes.find((n) => n.id === edge.target)?.label ?? edge.target;
    return {
      title: `${sourceLabel} — ${targetLabel}`,
      subtitle: `connection · co-occur in ${edge.ticketIds.length} incident${
        edge.ticketIds.length === 1 ? "" : "s"
      } · count ${edge.count} · PMI ${edge.pmi.toFixed(2)}`,
      targets: [edge.source, edge.target],
      ticketIds: edge.ticketIds,
    };
  }, [graph, selection]);

  if (!graph) return null;

  if (!content) {
    return (
      <aside className="hidden w-72 shrink-0 border-l border-zinc-300 bg-white p-4 text-xs text-zinc-400 lg:block dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-medium text-zinc-500 dark:text-zinc-400">Drill-in</p>
        <p className="mt-2">
          Click a <b>node</b> to list every incident containing that term, or an <b>edge</b> to see
          the incidents where both terms co-occur.
        </p>
      </aside>
    );
  }

  const tickets = content.ticketIds
    .map((id) => ticketsById.get(id))
    .filter((t): t is Ticket => Boolean(t));

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold">{content.title}</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{content.subtitle}</p>
        </div>
        <button
          onClick={() => setSelection(null)}
          className="ml-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Close evidence panel"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {tickets.map((t) => {
          const url = ticketUrl(urlTemplate, t.ticket_id);
          return (
            <article
              key={t.ticket_id}
              className="rounded border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {t.ticket_id}
                  </a>
                ) : (
                  <span className="font-mono text-xs font-semibold">{t.ticket_id}</span>
                )}
                <CopyButton value={t.ticket_id} />
                {t.opened_at && (
                  <span className="ml-auto font-mono text-[10px] text-zinc-400">
                    {t.opened_at.slice(0, 10)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-snug">
                {highlightTerms(t.short_description ?? "", content.targets, compiled)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {t.priority && <Chip>{t.priority}</Chip>}
                {t.category && <Chip>{t.category}</Chip>}
                {t.business_unit && <Chip>{t.business_unit}</Chip>}
                {t.location && <Chip>{t.location}</Chip>}
                {t.country && <Chip>{t.country}</Chip>}
                {t.status && <Chip>{t.status}</Chip>}
              </div>
            </article>
          );
        })}
        {tickets.length === 0 && (
          <p className="text-xs text-zinc-400">
            No matching incidents in the current filter scope.
          </p>
        )}
      </div>
    </aside>
  );
}
