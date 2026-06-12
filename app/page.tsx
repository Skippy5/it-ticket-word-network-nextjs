"use client";

import { useEffect } from "react";
import { EvidencePanel } from "@/components/EvidencePanel";
import { FilterRail } from "@/components/FilterRail";
import { GraphPanel } from "@/components/GraphPanel";
import { Header } from "@/components/Header";
import { useDataStore, useSettingsStore } from "@/lib/store";
import { syncThemeFromDocument } from "@/lib/theme";
import { useGraphComputation } from "@/lib/useGraphComputation";

export default function Home() {
  const { filteredTickets } = useGraphComputation();
  const warnings = useDataStore((s) => s.warnings);

  useEffect(() => {
    syncThemeFromDocument();
    if (process.env.NODE_ENV === "development") {
      // dev console access for debugging: __stores.data.getState() etc.
      (window as unknown as Record<string, unknown>).__stores = {
        data: useDataStore,
        settings: useSettingsStore,
      };
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <Header filteredCount={filteredTickets.length} />
      {warnings.length > 0 && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <FilterRail filteredTickets={filteredTickets} />
        <main className="relative min-w-0 flex-1">
          <GraphPanel />
        </main>
        <EvidencePanel filteredTickets={filteredTickets} />
      </div>
    </div>
  );
}
