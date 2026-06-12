/** Canonical ticket columns. Extra CSV columns are kept as pass-through metadata. */
export const TEXT_COLUMNS = ["short_description", "work_notes", "close_notes"] as const;
export type TextColumn = (typeof TEXT_COLUMNS)[number];

export const FILTER_COLUMNS = [
  "business_unit",
  "location",
  "country",
  "state",
  "category",
  "assignment_group",
  "priority",
  "status",
] as const;
export type FilterColumn = (typeof FILTER_COLUMNS)[number];

export const CANONICAL_COLUMNS = [
  "ticket_id",
  "opened_at",
  "category",
  "subcategory",
  "assignment_group",
  "priority",
  "short_description",
  "work_notes",
  "close_notes",
  "status",
  "business_unit",
  "location",
  "country",
  "state",
] as const;

export interface Ticket {
  ticket_id: string;
  opened_at?: string;
  category?: string;
  subcategory?: string;
  assignment_group?: string;
  priority?: string;
  short_description?: string;
  work_notes?: string;
  close_notes?: string;
  status?: string;
  business_unit?: string;
  location?: string;
  country?: string;
  state?: string;
  /** pass-through metadata for unknown columns */
  [key: string]: string | undefined;
}

/** Filters applied before the network is computed. */
export interface Filters {
  values: Partial<Record<FilterColumn, string[]>>;
  openedFrom?: string; // yyyy-mm-dd
  openedTo?: string; // yyyy-mm-dd
}

/** Pipeline / text-processing options (pure data, no functions — worker safe). */
export interface PipelineOptions {
  textColumns: TextColumn[];
  /** editable IT/ticketing stop-words (the base English list is built in) */
  customStopwords: string[];
  /** token -> replacement (replacement may be multi-word, becomes a phrase) */
  synonyms: Record<string, string>;
  /** seed bigram phrases kept as single nodes */
  phrases: string[];
  /** enable phrase handling (seed list + detection) */
  phrasesEnabled: boolean;
  /** auto-detect frequent bigrams as phrases */
  autoPhrases: boolean;
  /** min times an adjacent pair must appear to be auto-promoted */
  autoPhraseMinCount: number;
}

/** Co-occurrence + pruning options. */
export interface CooccurrenceOptions {
  scope: "document" | "window";
  windowSize: number;
  weighting: "count" | "pmi";
  minFreq: number;
  minEdge: number;
  maxTerms: number;
}

export interface ClusterOptions {
  resolution: number;
  seed: number;
}

export interface GraphSettings {
  pipeline: PipelineOptions;
  cooccurrence: CooccurrenceOptions;
  clustering: ClusterOptions;
}

/** One processed ticket-document: the unique normalized terms it contains. */
export interface TermDoc {
  ticketId: string;
  /** ordered tokens (for window scope) */
  tokens: string[];
  /** unique terms */
  terms: string[];
}

export interface TermStats {
  term: string;
  /** display label = most frequent surface form */
  label: string;
  /** number of tickets containing the term (document frequency) */
  freq: number;
  ticketIds: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  freq: number;
  community: number;
  ticketIds: string[];
}

export interface GraphEdge {
  id: string; // "a|b" with a < b
  source: string;
  target: string;
  count: number;
  pmi: number;
  weight: number; // count or pmi depending on settings
  ticketIds: string[];
}

export interface Community {
  id: number;
  /** member terms sorted by frequency desc */
  terms: { id: string; label: string; freq: number }[];
  size: number;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: Community[];
  stats: {
    docCount: number;
    totalTerms: number; // vocabulary size before pruning
    keptTerms: number;
    totalEdges: number; // edges before pruning
    keptEdges: number;
    detectedPhrases: string[];
  };
}
