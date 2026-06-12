"use client";

/**
 * Hook that recomputes the network whenever the filtered population or the
 * settings change. Work happens in a Web Worker; falls back to the main
 * thread if workers are unavailable.
 */
import { useEffect, useMemo, useRef } from "react";
import { applyFilters } from "./filters";
import { useDataStore, useSettingsStore } from "./store";
import type { GraphSettings, Ticket } from "./types";

interface WorkerResponseData {
  id: number;
  result?: import("./types").GraphResult;
  error?: string;
}

export function useGraphComputation() {
  const tickets = useDataStore((s) => s.tickets);
  const filters = useDataStore((s) => s.filters);
  const setGraph = useDataStore((s) => s.setGraph);
  const setComputing = useDataStore((s) => s.setComputing);
  const settings = useSettingsStore((s) => s.settings);

  const filteredTickets = useMemo(() => applyFilters(tickets, filters), [tickets, filters]);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (filteredTickets.length === 0) {
      setGraph(null);
      setComputing(false);
      return;
    }
    const id = ++requestIdRef.current;
    setComputing(true);

    const runOnMainThread = async () => {
      const { computeGraph } = await import("./computeGraph");
      // yield a frame so the spinner can paint
      await new Promise((r) => setTimeout(r, 0));
      if (id !== requestIdRef.current) return;
      try {
        const result = computeGraph(filteredTickets as Ticket[], settings as GraphSettings);
        if (id === requestIdRef.current) {
          setGraph(result);
          setComputing(false);
        }
      } catch (err) {
        console.error("graph computation failed", err);
        if (id === requestIdRef.current) {
          setGraph(null);
          setComputing(false);
        }
      }
    };

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("../workers/pipeline.worker.ts", import.meta.url));
      }
      const worker = workerRef.current;
      const onMessage = (event: MessageEvent<WorkerResponseData>) => {
        if (event.data.id !== requestIdRef.current) return;
        worker.removeEventListener("message", onMessage);
        if (event.data.result) {
          setGraph(event.data.result);
        } else {
          console.error("worker error:", event.data.error);
          setGraph(null);
        }
        setComputing(false);
      };
      worker.addEventListener("message", onMessage);
      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        void runOnMainThread();
      };
      worker.postMessage({ id, tickets: filteredTickets, settings });
    } catch {
      void runOnMainThread();
    }
  }, [filteredTickets, settings, setGraph, setComputing]);

  return { filteredTickets };
}
