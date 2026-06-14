"use client";

import { useRef, useState } from "react";
import { parseCsvFile, parseCsvText } from "@/lib/csv";
import { useDataStore } from "@/lib/store";
import { InfoDialog } from "./InfoDialog";
import { ThemeToggle } from "./ThemeToggle";

const DEMO_FILES = [
  { file: "it_tickets_small.csv", label: "Small (~90 tickets)" },
  { file: "it_tickets_large.csv", label: "Large (~320 tickets)" },
  { file: "it_tickets_multidept.csv", label: "Multi-dept (~220 tickets)" },
  { file: "it_tickets_messy.csv", label: "Messy (~150 tickets)" },
];

export function Header({ filteredCount }: { filteredCount: number }) {
  const tickets = useDataStore((s) => s.tickets);
  const sourceName = useDataStore((s) => s.sourceName);
  const computing = useDataStore((s) => s.computing);
  const setData = useDataStore((s) => s.setData);
  const appendData = useDataStore((s) => s.appendData);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      let first = true;
      for (const file of Array.from(files)) {
        const { tickets: parsed, warnings } = await parseCsvFile(file);
        if (first) {
          setData(parsed, file.name, warnings);
          first = false;
        } else {
          appendData(parsed, file.name, warnings);
        }
      }
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function loadDemo(file: string) {
    setDemoOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`samples/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const { tickets: parsed, warnings } = parseCsvText(text, file);
      setData(parsed, file, warnings);
    } catch (err) {
      setData([], "", [`Failed to load demo data ${file}: ${String(err)}`]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="flex items-center gap-4 border-b border-zinc-300 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-bold tracking-wide">IT Ticket Word Network</h1>
        <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
          word co-occurrence explorer
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {(computing || loading) && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            computing…
          </span>
        )}
        {tickets.length > 0 && (
          <span className="text-xs font-medium tabular-nums">
            Showing {filteredCount} of {tickets.length} incidents
            {sourceName && (
              <span className="ml-2 hidden text-zinc-500 lg:inline dark:text-zinc-400">
                · {sourceName}
              </span>
            )}
          </span>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Load CSV…
        </button>

        <div className="relative">
          <button
            onClick={() => setDemoOpen((o) => !o)}
            className="rounded border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            Demo data ▾
          </button>
          {demoOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDemoOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {DEMO_FILES.map((d) => (
                  <button
                    key={d.file}
                    onClick={() => void loadDemo(d.file)}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <span className="font-mono">{d.file}</span>
                    <span className="block text-zinc-500 dark:text-zinc-400">{d.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setInfoOpen(true)}
          title="About this tool — how it works"
          aria-label="About this tool"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-xs font-semibold hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          ⓘ
        </button>

        <ThemeToggle />
      </div>

      {infoOpen && <InfoDialog onClose={() => setInfoOpen(false)} />}
    </header>
  );
}
