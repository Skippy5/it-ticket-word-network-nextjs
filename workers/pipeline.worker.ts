/**
 * Web Worker: runs the full pipeline + co-occurrence + Louvain off the main
 * thread so the UI never blocks while the network is recomputed.
 */
import { computeGraph } from "../lib/computeGraph";
import type { GraphSettings, Ticket } from "../lib/types";

export interface WorkerRequest {
  id: number;
  tickets: Ticket[];
  settings: GraphSettings;
}

export interface WorkerResponse {
  id: number;
  result?: ReturnType<typeof computeGraph>;
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, tickets, settings } = event.data;
  try {
    const result = computeGraph(tickets, settings);
    const response: WorkerResponse = { id, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
