/**
 * CSV / JSON exports: node list, edge list (with co-occurring incident ids),
 * and the filtered incident list.
 */
import type { GraphResult, Ticket } from "./types";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export function nodesCsv(graph: GraphResult): string {
  const rows: string[][] = [["term", "label", "frequency", "community", "ticket_count", "ticket_ids"]];
  for (const n of graph.nodes) {
    rows.push([
      n.id,
      n.label,
      String(n.freq),
      String(n.community),
      String(n.ticketIds.length),
      n.ticketIds.join(";"),
    ]);
  }
  return toCsv(rows);
}

export function edgesCsv(graph: GraphResult): string {
  const rows: string[][] = [
    ["source", "target", "count", "pmi", "weight", "ticket_count", "ticket_ids"],
  ];
  for (const e of graph.edges) {
    rows.push([
      e.source,
      e.target,
      String(e.count),
      e.pmi.toFixed(4),
      e.weight.toFixed(4),
      String(e.ticketIds.length),
      e.ticketIds.join(";"),
    ]);
  }
  return toCsv(rows);
}

export function incidentsCsv(tickets: Ticket[]): string {
  if (tickets.length === 0) return "";
  const columns = [...new Set(tickets.flatMap((t) => Object.keys(t)))];
  const rows: string[][] = [columns];
  for (const t of tickets) {
    rows.push(columns.map((c) => t[c] ?? ""));
  }
  return toCsv(rows);
}

export function graphJson(graph: GraphResult): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      stats: graph.stats,
      nodes: graph.nodes,
      edges: graph.edges,
      communities: graph.communities.map((c) => ({
        id: c.id,
        size: c.size,
        terms: c.terms.map((t) => t.id),
      })),
    },
    null,
    2
  );
}

/** Trigger a browser download. */
export function downloadFile(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
