"use client";

/**
 * Force-directed canvas renderer (react-force-graph-2d).
 * Loaded only in the browser via next/dynamic (see GraphPanel).
 *
 * Readability choices (mirroring the vis-network reference build):
 * - labels are always drawn with a background-colored halo stroke so they
 *   stay legible over edges, sized with the node;
 * - a collision force keeps nodes (and their labels) from overlapping and a
 *   stronger charge spreads the clusters;
 * - an on-canvas toolbar exposes Physics ON/OFF, Fit and Clear selection.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide } from "d3-force";
import { mulberry32 } from "@/lib/clustering";
import { communityColor } from "@/lib/defaults";
import { useDataStore, useSettingsStore } from "@/lib/store";
import { useThemeStore } from "@/lib/theme";
import type { GraphEdge, GraphNode } from "@/lib/types";

interface VizNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface VizLink extends Omit<GraphEdge, "source" | "target"> {
  source: string | VizNode;
  target: string | VizNode;
}

function endpointId(end: string | VizNode): string {
  return typeof end === "object" ? end.id : end;
}

function stringHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function GraphView() {
  const graph = useDataStore((s) => s.graph)!;
  const selection = useDataStore((s) => s.selection);
  const setSelection = useDataStore((s) => s.setSelection);
  const physics = useSettingsStore((s) => s.physics);
  const setPhysics = useSettingsStore((s) => s.setPhysics);
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<VizNode, VizLink> | undefined>(undefined);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const hoverRef = useRef<string | null>(null);
  const didFitRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.max(rect.width, 50), height: Math.max(rect.height, 50) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Mutable copies for the renderer, with deterministic initial positions
   * (cluster centers on a circle, members scattered around them) so layouts
   * are comparable across runs.
   */
  const data = useMemo(() => {
    didFitRef.current = false;
    const nodes: VizNode[] = graph.nodes.map((n) => {
      const rng = mulberry32(stringHash(n.id));
      const angle = n.community * 2.39996; // golden angle per community
      const cx = Math.cos(angle) * 240;
      const cy = Math.sin(angle) * 240;
      return { ...n, x: cx + (rng() - 0.5) * 160, y: cy + (rng() - 0.5) * 160 };
    });
    const links: VizLink[] = graph.edges.map((e) => ({ ...e }));
    return { nodes, links };
  }, [graph]);

  /** adjacency + max weight for styling */
  const { neighbors, maxWeight, maxFreq, topNeighbors } = useMemo(() => {
    const neighbors = new Map<string, Set<string>>();
    const weighted = new Map<string, { id: string; label: string; weight: number }[]>();
    let maxWeight = 0;
    const labelById = new Map(graph.nodes.map((n) => [n.id, n.label]));
    for (const e of graph.edges) {
      maxWeight = Math.max(maxWeight, e.weight);
      for (const [a, b] of [
        [e.source, e.target],
        [e.target, e.source],
      ] as const) {
        if (!neighbors.has(a)) neighbors.set(a, new Set());
        neighbors.get(a)!.add(b);
        if (!weighted.has(a)) weighted.set(a, []);
        weighted.get(a)!.push({ id: b, label: labelById.get(b) ?? b, weight: e.weight });
      }
    }
    const topNeighbors = new Map<string, string[]>();
    for (const [id, list] of weighted) {
      topNeighbors.set(
        id,
        list
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5)
          .map((n) => n.label)
      );
    }
    const maxFreq = Math.max(1, ...graph.nodes.map((n) => n.freq));
    return { neighbors, maxWeight: Math.max(maxWeight, 1e-9), maxFreq, topNeighbors };
  }, [graph]);

  const nodeRadius = useCallback(
    (n: VizNode) => 4 + 11 * Math.sqrt(n.freq / maxFreq),
    [maxFreq]
  );

  /**
   * Spread the layout: stronger repulsion, longer links, and a collision
   * force so nodes + labels never pile up (the vis-network "avoidOverlap"
   * equivalent — the single biggest readability win).
   */
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-160);
    const link = fg.d3Force("link");
    if (link) link.distance(55);
    fg.d3Force(
      "collide",
      forceCollide<VizNode>()
        .radius((n) => nodeRadius(n) + 16)
        .strength(0.9)
    );
    fg.d3ReheatSimulation();
  }, [data, nodeRadius]);

  // re-heat the simulation when physics is switched back on
  useEffect(() => {
    if (physics) graphRef.current?.d3ReheatSimulation();
  }, [physics]);

  const selectedNode = selection?.kind === "node" ? selection.id : null;
  const selectedEdge = selection?.kind === "edge" ? selection.id : null;
  const selectedEdgeEnds = useMemo(() => {
    if (!selectedEdge) return null;
    const e = graph.edges.find((x) => x.id === selectedEdge);
    return e ? new Set([e.source, e.target]) : null;
  }, [selectedEdge, graph]);

  function nodeVisibility(id: string): "full" | "faded" {
    if (selectedNode) {
      if (id === selectedNode || neighbors.get(selectedNode)?.has(id)) return "full";
      return "faded";
    }
    if (selectedEdgeEnds) return selectedEdgeEnds.has(id) ? "full" : "faded";
    const hovered = hoverRef.current;
    if (hovered) {
      if (id === hovered || neighbors.get(hovered)?.has(id)) return "full";
      return "faded";
    }
    return "full";
  }

  const labelColor = dark ? "#e4e4e7" : "#27272a";
  const haloColor = dark ? "#09090b" : "#fafafa"; // canvas background per theme
  const fadedAlpha = 0.12;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <ForceGraph2D<VizNode, VizLink>
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={false}
        cooldownTicks={physics ? 300 : 0}
        onEngineStop={() => {
          if (!didFitRef.current) {
            didFitRef.current = true;
            graphRef.current?.zoomToFit(400, 40);
          }
        }}
        nodeLabel={(n) => {
          const tops = topNeighbors.get(n.id) ?? [];
          return `<div style="max-width:240px">
            <b>${n.label}</b><br/>
            ${n.freq} incident${n.freq === 1 ? "" : "s"} · cluster ${n.community + 1}<br/>
            ${tops.length > 0 ? `links: ${tops.join(", ")}` : "no links"}
          </div>`;
        }}
        nodeCanvasObject={(n, ctx, globalScale) => {
          const r = nodeRadius(n);
          const vis = nodeVisibility(n.id);
          const faded = vis === "faded";
          ctx.globalAlpha = faded ? fadedAlpha : 1;
          ctx.beginPath();
          ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
          ctx.fillStyle = communityColor(n.community);
          ctx.fill();
          if (n.id === selectedNode || n.id === hoverRef.current) {
            ctx.lineWidth = 1.5 / globalScale;
            ctx.strokeStyle = dark ? "#fafafa" : "#18181b";
            ctx.stroke();
          }

          // Always-on label with halo, sized with the node, with a screen-px
          // floor that grows with node importance so cluster anchors stay
          // readable even fully zoomed out. Tiny labels (<4.5px) are skipped.
          const importance = Math.sqrt(n.freq / maxFreq);
          const floorPx = 5 + 8 * importance;
          const fontSize = Math.max(Math.max(5, 3 + r * 0.6), floorPx / globalScale);
          if (!faded && fontSize * globalScale >= 4.5) {
            ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.lineWidth = Math.max(fontSize / 4, 1.5);
            ctx.lineJoin = "round";
            ctx.strokeStyle = haloColor;
            ctx.strokeText(n.label, n.x!, n.y! + r + 1.5);
            ctx.fillStyle = labelColor;
            ctx.fillText(n.label, n.x!, n.y! + r + 1.5);
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(n, color, ctx) => {
          ctx.beginPath();
          ctx.arc(n.x!, n.y!, nodeRadius(n) + 4, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={(l) => {
          const a = endpointId(l.source);
          const b = endpointId(l.target);
          if (selectedEdge && l.id === selectedEdge) return dark ? "#fbbf24" : "#d97706";
          const focus = selectedNode ?? hoverRef.current;
          if (focus && (a === focus || b === focus)) {
            return dark ? "rgba(212,212,216,0.65)" : "rgba(63,63,70,0.6)";
          }
          if (selectedNode || selectedEdge || hoverRef.current) {
            return dark ? "rgba(161,161,170,0.05)" : "rgba(113,113,122,0.05)";
          }
          return dark ? "rgba(161,161,170,0.16)" : "rgba(113,113,122,0.18)";
        }}
        linkWidth={(l) => {
          const base = 0.5 + 3.5 * (l.weight / maxWeight);
          return l.id === selectedEdge ? base + 1.5 : base;
        }}
        linkHoverPrecision={6}
        onNodeClick={(n) => setSelection({ kind: "node", id: n.id })}
        onLinkClick={(l) => setSelection({ kind: "edge", id: l.id })}
        onNodeHover={(n) => {
          hoverRef.current = n ? n.id : null;
          if (containerRef.current) containerRef.current.style.cursor = n ? "pointer" : "default";
        }}
        onLinkHover={(l) => {
          if (containerRef.current) containerRef.current.style.cursor = l ? "pointer" : "default";
        }}
        onBackgroundClick={() => setSelection(null)}
      />

      {/* on-canvas toolbar */}
      <div className="absolute right-3 top-3 flex gap-1.5">
        <button
          onClick={() => setPhysics(!physics)}
          className="rounded border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:bg-zinc-800"
        >
          Physics: {physics ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => graphRef.current?.zoomToFit(400, 40)}
          className="rounded border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:bg-zinc-800"
        >
          Fit
        </button>
        <button
          onClick={() => setSelection(null)}
          disabled={!selection}
          className="rounded border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:bg-zinc-800"
        >
          Clear selection
        </button>
      </div>

      {/* cluster legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 max-h-48 max-w-72 overflow-hidden rounded border border-zinc-200 bg-white/85 p-2 text-[11px] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="mb-1 font-semibold text-zinc-500 dark:text-zinc-400">
          Clusters ({graph.communities.length})
        </div>
        {graph.communities.slice(0, 8).map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 truncate">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: communityColor(c.id) }}
            />
            <span className="truncate">
              {c.terms.slice(0, 3).map((t) => t.label).join(", ")}
              {c.terms.length > 3 ? "…" : ""}
            </span>
          </div>
        ))}
        {graph.communities.length > 8 && (
          <div className="text-zinc-400">+{graph.communities.length - 8} more</div>
        )}
      </div>
    </div>
  );
}
