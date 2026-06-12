import { describe, expect, it } from "vitest";
import { buildCooccurrence, edgeId, positivePmi } from "../lib/cooccurrence";
import { computeGraph } from "../lib/computeGraph";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import type { CooccurrenceOptions, TermDoc, TermStats, Ticket } from "../lib/types";

const options: CooccurrenceOptions = {
  scope: "document",
  windowSize: 10,
  weighting: "count",
  minFreq: 1,
  minEdge: 1,
  maxTerms: 100,
};

function doc(ticketId: string, terms: string[]): TermDoc {
  return { ticketId, tokens: terms, terms: [...new Set(terms)] };
}

function stats(docs: TermDoc[]): Map<string, TermStats> {
  const map = new Map<string, TermStats>();
  for (const d of docs) {
    for (const t of d.terms) {
      const cur = map.get(t) ?? { term: t, label: t, freq: 0, ticketIds: [] };
      cur.freq++;
      cur.ticketIds.push(d.ticketId);
      map.set(t, cur);
    }
  }
  return map;
}

describe("positivePmi", () => {
  it("matches max(0, log2(c_ab*N / (c_a*c_b)))", () => {
    // c_ab=4, c_a=4, c_b=4, N=8 -> log2(4*8/16) = log2(2) = 1
    expect(positivePmi(4, 4, 4, 8)).toBeCloseTo(1, 10);
    // independent terms -> log2(1) = 0
    expect(positivePmi(2, 4, 4, 8)).toBeCloseTo(0, 10);
    // negative association clamps to 0
    expect(positivePmi(1, 4, 4, 8)).toBe(0);
  });
});

describe("buildCooccurrence", () => {
  const docs = [
    doc("INC1", ["printer", "jam", "toner"]),
    doc("INC2", ["printer", "jam"]),
    doc("INC3", ["printer", "queue"]),
    doc("INC4", ["vpn", "dns"]),
  ];
  const termStats = stats(docs);

  it("counts a pair once per ticket and records the incident ids (edge -> incidents)", () => {
    const { edges } = buildCooccurrence(docs, termStats, options);
    const pj = edges.find((e) => e.id === edgeId("printer", "jam"));
    expect(pj).toBeDefined();
    expect(pj!.count).toBe(2);
    expect(pj!.ticketIds.sort()).toEqual(["INC1", "INC2"]);
  });

  it("creates no self-loops", () => {
    const { edges } = buildCooccurrence(
      [doc("INC1", ["a", "a", "b"])],
      stats([doc("INC1", ["a", "a", "b"])]),
      options
    );
    expect(edges.every((e) => e.source !== e.target)).toBe(true);
  });

  it("prunes by min term frequency, min edge count, and max terms", () => {
    const byFreq = buildCooccurrence(docs, termStats, { ...options, minFreq: 2 });
    expect(byFreq.kept.map((t) => t.term)).toEqual(["printer", "jam"]);

    const byEdge = buildCooccurrence(docs, termStats, { ...options, minEdge: 2 });
    expect(byEdge.edges.map((e) => e.id)).toEqual([edgeId("printer", "jam")]);

    const byTop = buildCooccurrence(docs, termStats, { ...options, maxTerms: 1 });
    expect(byTop.kept).toHaveLength(1);
    expect(byTop.kept[0].term).toBe("printer");
  });

  it("computes PMI per edge and uses it as weight when selected", () => {
    const { edges } = buildCooccurrence(docs, termStats, { ...options, weighting: "pmi" });
    const pj = edges.find((e) => e.id === edgeId("printer", "jam"))!;
    // c_ab=2, c_printer=3, c_jam=2, N=4 -> log2(2*4/6) = log2(4/3)
    expect(pj.pmi).toBeCloseTo(Math.log2(4 / 3), 10);
    expect(pj.weight).toBeCloseTo(pj.pmi, 10);
  });

  it("window scope only links terms within the window", () => {
    const d = doc("INC1", ["a", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "b"]);
    const s = stats([d]);
    const far = buildCooccurrence([d], s, { ...options, scope: "window", windowSize: 3 });
    expect(far.edges.find((e) => e.id === edgeId("a", "b"))).toBeUndefined();
    const near = buildCooccurrence([d], s, { ...options, scope: "window", windowSize: 20 });
    expect(near.edges.find((e) => e.id === edgeId("a", "b"))).toBeDefined();
  });
});

describe("computeGraph end-to-end", () => {
  const tickets: Ticket[] = [
    { ticket_id: "INC1", short_description: "printer paper jam in queue" },
    { ticket_id: "INC2", short_description: "printer jam again toner low" },
    { ticket_id: "INC3", short_description: "printer jam paper stuck" },
    { ticket_id: "INC4", short_description: "vpn dns failure" },
    { ticket_id: "INC5", short_description: "vpn dns timeout" },
    { ticket_id: "INC6", short_description: "vpn dns drops" },
  ];
  const settings = {
    ...DEFAULT_SETTINGS,
    pipeline: { ...DEFAULT_SETTINGS.pipeline, phrasesEnabled: false, autoPhrases: false },
    cooccurrence: { ...DEFAULT_SETTINGS.cooccurrence, minFreq: 2, minEdge: 2 },
  };

  it("produces deterministic clusters separating unrelated themes", () => {
    const a = computeGraph(tickets, settings);
    const b = computeGraph(tickets, settings);
    expect(a.nodes.map((n) => `${n.id}:${n.community}`)).toEqual(
      b.nodes.map((n) => `${n.id}:${n.community}`)
    );
    const community = (id: string) => a.nodes.find((n) => n.id === id)?.community;
    expect(community("print")).toBe(community("jam"));
    expect(community("vpn")).toBe(community("dns"));
    expect(community("print")).not.toBe(community("vpn"));
  });

  it("edge drill-in lists exactly the incidents where both terms co-occur", () => {
    const g = computeGraph(tickets, settings);
    const edge = g.edges.find((e) => e.id === edgeId("jam", "print"));
    expect(edge).toBeDefined();
    expect(edge!.ticketIds.sort()).toEqual(["INC1", "INC2", "INC3"]);
  });
});
