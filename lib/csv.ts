/**
 * CSV loading with PapaParse. Header names are matched case-insensitively;
 * unknown columns are kept as pass-through metadata. Never throws on bad
 * cells — problems surface as in-UI warnings.
 */
import Papa from "papaparse";
import { CANONICAL_COLUMNS, type Ticket } from "./types";

export interface CsvLoadResult {
  tickets: Ticket[];
  warnings: string[];
}

/** Map raw header -> canonical name (case/space-insensitive). */
function canonicalField(raw: string): string {
  const norm = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const hit = CANONICAL_COLUMNS.find((c) => c === norm);
  return hit ?? norm;
}

function normalizeRows(rows: Record<string, unknown>[], fileName: string): CsvLoadResult {
  const warnings: string[] = [];
  const tickets: Ticket[] = [];
  let missingId = 0;

  let fieldMap: Map<string, string> | null = null;

  for (const row of rows) {
    if (!fieldMap) {
      fieldMap = new Map(Object.keys(row).map((k) => [k, canonicalField(k)]));
      const have = new Set(fieldMap.values());
      if (!have.has("ticket_id")) {
        warnings.push(
          `${fileName}: required column "ticket_id" not found — rows from this file are skipped.`
        );
      }
      const missingText = ["short_description", "work_notes", "close_notes"].filter(
        (c) => !have.has(c)
      );
      if (missingText.length === 3) {
        warnings.push(
          `${fileName}: no text columns found (short_description / work_notes / close_notes).`
        );
      } else if (missingText.length > 0) {
        warnings.push(`${fileName}: missing text column(s): ${missingText.join(", ")}.`);
      }
      for (const c of ["business_unit", "location", "country", "state"]) {
        if (!have.has(c)) warnings.push(`${fileName}: missing filter column "${c}".`);
      }
    }

    const ticket: Ticket = { ticket_id: "" };
    for (const [rawKey, value] of Object.entries(row)) {
      const key = fieldMap.get(rawKey) ?? canonicalField(rawKey);
      ticket[key] = value == null ? "" : String(value).trim();
    }
    if (!ticket.ticket_id) {
      missingId++;
      continue;
    }
    tickets.push(ticket);
  }

  if (missingId > 0) {
    warnings.push(`${fileName}: skipped ${missingId} row(s) without a ticket_id.`);
  }
  return { tickets, warnings };
}

/** Parse an uploaded File (PapaParse worker mode keeps the UI responsive). */
export function parseCsvFile(file: File): Promise<CsvLoadResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete: (results) => {
        const out = normalizeRows(results.data, file.name);
        for (const err of results.errors.slice(0, 3)) {
          out.warnings.push(`${file.name}: parse warning (row ${err.row ?? "?"}): ${err.message}`);
        }
        resolve(out);
      },
      error: (err: Error) => {
        resolve({ tickets: [], warnings: [`${file.name}: failed to parse — ${err.message}`] });
      },
    });
  });
}

/** Parse CSV text (used for the bundled demo datasets). */
export function parseCsvText(text: string, name: string): CsvLoadResult {
  const results = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  const out = normalizeRows(results.data, name);
  for (const err of results.errors.slice(0, 3)) {
    out.warnings.push(`${name}: parse warning (row ${err.row ?? "?"}): ${err.message}`);
  }
  return out;
}
