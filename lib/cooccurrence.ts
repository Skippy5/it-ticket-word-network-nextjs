/**
 * Co-occurrence counting, PMI weighting and pruning.
 * Pure TypeScript — worker- and test-friendly.
 */
import type { CooccurrenceOptions, GraphEdge, TermDoc, TermStats } from "./types";

export interface CooccurrenceResult {
  /** terms that survived pruning, with stats */
  kept: TermStats[];
  edges: GraphEdge[];
  totalEdges: number;
  totalTerms: number;
}

export function edgeId(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Unique co-occurring term pairs for one document under the given scope.
 * Document scope: every unique pair of terms in the ticket.
 * Window scope: pairs whose tokens appear within `windowSize` of each other.
 */
export function docPairs(doc: TermDoc, options: CooccurrenceOptions, vocab: Set<string>): Set<string> {
  const pairs = new Set<string>();
  if (options.scope === "document") {
    const terms = doc.terms.filter((t) => vocab.has(t));
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        if (terms[i] !== terms[j]) pairs.add(edgeId(terms[i], terms[j]));
      }
    }
  } else {
    const tokens = doc.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (!vocab.has(tokens[i])) continue;
      const end = Math.min(tokens.length, i + options.windowSize + 1);
      for (let j = i + 1; j < end; j++) {
        if (!vocab.has(tokens[j])) continue;
        if (tokens[i] !== tokens[j]) pairs.add(edgeId(tokens[i], tokens[j]));
      }
    }
  }
  return pairs;
}

/** Positive PMI: max(0, log2(c_ab * N / (c_a * c_b))). */
export function positivePmi(cab: number, ca: number, cb: number, n: number): number {
  if (cab <= 0 || ca <= 0 || cb <= 0 || n <= 0) return 0;
  return Math.max(0, Math.log2((cab * n) / (ca * cb)));
}

/**
 * Build the pruned co-occurrence edge list.
 * Pruning: min term frequency -> top-N terms by frequency -> min edge count.
 * No self-loops by construction. Every edge retains the ticket ids behind it.
 */
export function buildCooccurrence(
  docs: TermDoc[],
  termStats: Map<string, TermStats>,
  options: CooccurrenceOptions
): CooccurrenceResult {
  const totalTerms = termStats.size;
  const n = docs.length;

  // 1. prune by min frequency, keep top-N by frequency
  const kept = [...termStats.values()]
    .filter((t) => t.freq >= options.minFreq)
    .sort((a, b) => b.freq - a.freq || a.term.localeCompare(b.term))
    .slice(0, options.maxTerms);
  const vocab = new Set(kept.map((t) => t.term));

  // 2. count pairs per document (a pair counts once per ticket)
  const pairCounts = new Map<string, { count: number; ticketIds: string[] }>();
  for (const doc of docs) {
    for (const pair of docPairs(doc, options, vocab)) {
      let entry = pairCounts.get(pair);
      if (!entry) {
        entry = { count: 0, ticketIds: [] };
        pairCounts.set(pair, entry);
      }
      entry.count++;
      entry.ticketIds.push(doc.ticketId);
    }
  }
  const totalEdges = pairCounts.size;

  // 3. weight + prune by min edge count
  const edges: GraphEdge[] = [];
  for (const [pair, { count, ticketIds }] of pairCounts) {
    if (count < options.minEdge) continue;
    const [a, b] = pair.split("|");
    const ca = termStats.get(a)?.freq ?? 0;
    const cb = termStats.get(b)?.freq ?? 0;
    const pmi = positivePmi(count, ca, cb, n);
    edges.push({
      id: pair,
      source: a,
      target: b,
      count,
      pmi,
      weight: options.weighting === "pmi" ? pmi : count,
      ticketIds,
    });
  }
  edges.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

  return { kept, edges, totalEdges, totalTerms };
}
