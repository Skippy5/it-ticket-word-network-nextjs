/**
 * Ticket filtering with faceted option lists and geographic cascade
 * (country -> state -> location).
 */
import { FILTER_COLUMNS, type FilterColumn, type Filters, type Ticket } from "./types";

export const EMPTY_FILTERS: Filters = { values: {} };

function matchesField(ticket: Ticket, field: FilterColumn, selected: string[] | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.includes(ticket[field] ?? "");
}

function matchesDate(ticket: Ticket, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const raw = ticket.opened_at ?? "";
  const day = raw.slice(0, 10); // "yyyy-mm-dd hh:mm" -> "yyyy-mm-dd"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true; // unparseable -> keep
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Apply all active filters (AND across fields, OR within a field). */
export function applyFilters(tickets: Ticket[], filters: Filters): Ticket[] {
  return tickets.filter(
    (t) =>
      FILTER_COLUMNS.every((f) => matchesField(t, f, filters.values[f])) &&
      matchesDate(t, filters.openedFrom, filters.openedTo)
  );
}

/**
 * Option list for one field, faceted by the selections on every OTHER field
 * (this is what makes geography cascade: picking a country narrows state and
 * location options to that country's tickets).
 */
export function optionsForField(
  tickets: Ticket[],
  filters: Filters,
  field: FilterColumn
): string[] {
  const others: Filters = {
    ...filters,
    values: { ...filters.values, [field]: undefined },
  };
  const pool = applyFilters(tickets, others);
  const values = new Set<string>();
  for (const t of pool) {
    const v = t[field];
    if (v) values.add(v);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

/** Drop selections that are no longer present in their option lists. */
export function pruneOrphanSelections(tickets: Ticket[], filters: Filters): Filters {
  let changed = false;
  const values: Filters["values"] = { ...filters.values };
  // geographic cascade order matters: country first, then state, then location
  const order: FilterColumn[] = [
    "country",
    "state",
    "location",
    "business_unit",
    "category",
    "assignment_group",
    "priority",
    "status",
  ];
  const current: Filters = { ...filters, values };
  for (const field of order) {
    const selected = values[field];
    if (!selected || selected.length === 0) continue;
    const valid = new Set(optionsForField(tickets, current, field));
    const kept = selected.filter((v) => valid.has(v));
    if (kept.length !== selected.length) {
      values[field] = kept.length > 0 ? kept : undefined;
      changed = true;
    }
  }
  return changed ? { ...filters, values } : filters;
}

export function countActiveFilters(filters: Filters): number {
  let n = 0;
  for (const f of FILTER_COLUMNS) {
    if ((filters.values[f]?.length ?? 0) > 0) n++;
  }
  if (filters.openedFrom) n++;
  if (filters.openedTo) n++;
  return n;
}
