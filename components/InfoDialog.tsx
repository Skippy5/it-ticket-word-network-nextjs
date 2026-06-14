"use client";

/**
 * "How it works" help dialog — a plain-language tour of what the app does and
 * how to read the network. Opened from the header info button.
 */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
        {n}
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{children}</p>
      </div>
    </div>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-zinc-800 dark:text-zinc-100">{children}</span>;
}

export function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-300 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">About this tool</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            This tool reads the free text in your IT tickets (short description, work notes, close
            notes) and draws a <Term>word co-occurrence network</Term>: words that frequently appear
            in the same tickets are linked, and tightly connected words are grouped into colored{" "}
            <Term>clusters</Term> — the recurring problem themes in your queue. Everything runs in
            your browser; <Term>ticket data never leaves this machine</Term>.
          </p>

          <div className="space-y-4">
            <Step n={1} title="Load tickets">
              Click <Term>Load CSV…</Term> to upload one or more exports, or pick a bundled set under{" "}
              <Term>Demo data</Term>. Only a <code>ticket_id</code> and at least one text column are
              required; extra columns are kept for filtering and drill-in.
            </Step>
            <Step n={2} title="Filter the population">
              Use the left rail to narrow by business unit, location, country, state, and more.
              Geography cascades (country → state → location) and the network{" "}
              <Term>recomputes on whatever is in scope</Term>.
            </Step>
            <Step n={3} title="Read the network">
              Each <Term>node</Term> is a term; bigger means it appears in more tickets. Each{" "}
              <Term>edge</Term> means two terms co-occur; thicker means more often. Color = cluster.
              Drag to pan, scroll to zoom, and use <Term>Physics / Fit / Clear</Term> on the canvas.
            </Step>
            <Step n={4} title="Drill into incidents">
              <Term>Click a node</Term> to list every incident containing that term, or{" "}
              <Term>click an edge</Term> to see the incidents where both terms co-occur — the
              evidence behind the link, with matches highlighted. Incident IDs are copyable and can
              link to your ticketing system (set a URL template in Settings).
            </Step>
            <Step n={5} title="Tune & export">
              Adjust term/edge thresholds, weighting (count vs PMI), clustering resolution, and the
              stop-word / synonym / phrase dictionaries. Export the node list, edge list (with the
              co-occurring incident IDs), filtered incidents, or the full graph as CSV/JSON.
            </Step>
          </div>

          <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <span className="font-semibold">Tip:</span> if the canvas comes back empty after
            filtering, lower <Term>Min term frequency</Term> / <Term>Min edge count</Term> in the
            left rail — a small population may not clear the default thresholds.
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Built with Fable 5</span>
          <button
            onClick={onClose}
            className="rounded bg-blue-600 px-4 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
