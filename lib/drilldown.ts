/**
 * Drill-in helpers: map nodes/edges back to the incidents that produced them.
 */
import type { GraphEdge, GraphNode, Ticket } from "./types";

export interface IncidentHit {
  ticket: Ticket;
}

/** Tickets behind a term node, in original order. */
export function ticketsForNode(node: GraphNode, ticketsById: Map<string, Ticket>): Ticket[] {
  return node.ticketIds
    .map((id) => ticketsById.get(id))
    .filter((t): t is Ticket => Boolean(t));
}

/** Tickets where BOTH edge endpoints co-occur — the evidence for the link. */
export function ticketsForEdge(edge: GraphEdge, ticketsById: Map<string, Ticket>): Ticket[] {
  return edge.ticketIds
    .map((id) => ticketsById.get(id))
    .filter((t): t is Ticket => Boolean(t));
}

export function indexTickets(tickets: Ticket[]): Map<string, Ticket> {
  const map = new Map<string, Ticket>();
  for (const t of tickets) {
    if (t.ticket_id) map.set(t.ticket_id, t);
  }
  return map;
}

/** Fill a configurable URL template, e.g. ".../incident.do?number={ticket_id}". */
export function ticketUrl(template: string, ticketId: string): string | null {
  if (!template.trim()) return null;
  return template.replaceAll("{ticket_id}", encodeURIComponent(ticketId));
}
