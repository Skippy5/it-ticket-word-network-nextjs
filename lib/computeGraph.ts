/**
 * End-to-end graph computation: pipeline -> co-occurrence -> clustering.
 * Called from the Web Worker (preferred) or the main thread as a fallback.
 */
import { buildCooccurrence } from "./cooccurrence";
import { detectCommunities } from "./clustering";
import { runPipeline } from "./pipeline";
import type { Community, GraphResult, GraphSettings, Ticket } from "./types";

export function computeGraph(tickets: Ticket[], settings: GraphSettings): GraphResult {
  const { docs, termStats, detectedPhrases } = runPipeline(tickets, settings.pipeline);
  const { kept, edges, totalEdges, totalTerms } = buildCooccurrence(
    docs,
    termStats,
    settings.cooccurrence
  );
  const communities = detectCommunities(kept, edges, settings.clustering);

  const nodes = kept.map((t) => ({
    id: t.term,
    label: t.label,
    freq: t.freq,
    community: communities.get(t.term) ?? 0,
    ticketIds: t.ticketIds,
  }));

  const byCommunity = new Map<number, Community>();
  for (const n of nodes) {
    let c = byCommunity.get(n.community);
    if (!c) {
      c = { id: n.community, terms: [], size: 0 };
      byCommunity.set(n.community, c);
    }
    c.terms.push({ id: n.id, label: n.label, freq: n.freq });
    c.size++;
  }
  for (const c of byCommunity.values()) {
    c.terms.sort((a, b) => b.freq - a.freq || a.id.localeCompare(b.id));
  }

  return {
    nodes,
    edges,
    communities: [...byCommunity.values()].sort((a, b) => a.id - b.id),
    stats: {
      docCount: docs.length,
      totalTerms,
      keptTerms: nodes.length,
      totalEdges,
      keptEdges: edges.length,
      detectedPhrases,
    },
  };
}
