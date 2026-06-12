/**
 * Community detection: graphology + Louvain with a seeded RNG so cluster
 * assignments are deterministic across runs.
 */
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import type { ClusterOptions, GraphEdge, TermStats } from "./types";

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Assign a community id to every term. Terms with no surviving edges get
 * their own singleton communities (numbered after the detected ones).
 * Community ids are renumbered by descending community size for stable colors.
 */
export function detectCommunities(
  terms: TermStats[],
  edges: GraphEdge[],
  options: ClusterOptions
): Map<string, number> {
  const graph = new Graph({ type: "undirected" });
  for (const t of terms) graph.addNode(t.term);
  for (const e of edges) {
    if (!graph.hasEdge(e.source, e.target)) {
      graph.addEdge(e.source, e.target, { weight: Math.max(e.weight, 1e-9) });
    }
  }

  const raw = new Map<string, number>();
  if (graph.order > 0 && graph.size > 0) {
    const assignments = louvain(graph, {
      resolution: options.resolution,
      rng: mulberry32(options.seed),
      getEdgeWeight: "weight",
    });
    for (const [node, community] of Object.entries(assignments)) {
      raw.set(node, community as number);
    }
  }

  // singleton communities for isolated nodes
  let nextId = raw.size > 0 ? Math.max(...raw.values()) + 1 : 0;
  for (const t of terms) {
    if (!raw.has(t.term)) raw.set(t.term, nextId++);
  }

  // renumber by community weight (sum of member frequencies, desc)
  const freqByTerm = new Map(terms.map((t) => [t.term, t.freq]));
  const sizeByCommunity = new Map<number, number>();
  for (const [term, c] of raw) {
    sizeByCommunity.set(c, (sizeByCommunity.get(c) ?? 0) + (freqByTerm.get(term) ?? 0));
  }
  const order = [...sizeByCommunity.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([c]) => c);
  const renumber = new Map(order.map((c, i) => [c, i]));

  const result = new Map<string, number>();
  for (const [term, c] of raw) result.set(term, renumber.get(c) ?? 0);
  return result;
}
