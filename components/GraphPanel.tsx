"use client";

import dynamic from "next/dynamic";
import { useDataStore } from "@/lib/store";

/**
 * The force-graph renderer is browser-only (canvas + window), so it is
 * imported with ssr:false — this also keeps static export working.
 */
const GraphView = dynamic(() => import("./GraphView").then((m) => m.GraphView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
      loading renderer…
    </div>
  ),
});

function CenterCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-zinc-300 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold">{title}</h2>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{children}</div>
      </div>
    </div>
  );
}

export function GraphPanel() {
  const tickets = useDataStore((s) => s.tickets);
  const graph = useDataStore((s) => s.graph);
  const computing = useDataStore((s) => s.computing);

  if (tickets.length === 0) {
    return (
      <CenterCard title="No data loaded">
        <p>
          Load one or more ticket CSVs with the <b>Load CSV…</b> button, or pick a bundled
          dataset under <b>Demo data</b>. All processing happens in your browser — ticket data
          never leaves this machine.
        </p>
      </CenterCard>
    );
  }

  if (!graph && computing) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
        computing network…
      </div>
    );
  }

  if (!graph) {
    return (
      <CenterCard title="No incidents in scope">
        <p>The current filters match no tickets. Loosen or reset the filters in the left rail.</p>
      </CenterCard>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <CenterCard title="Nothing survived pruning">
        <p>
          {graph.stats.docCount} incidents are in scope, but no terms passed the thresholds. Try
          lowering <b>Min term frequency</b> / <b>Min edge count</b> in the left rail, or include
          more text sources.
        </p>
      </CenterCard>
    );
  }

  return <GraphView />;
}
