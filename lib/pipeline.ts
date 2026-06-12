/**
 * Text-processing pipeline: clean -> tokenize -> synonyms -> phrases ->
 * stop-words -> stem -> per-ticket term sets.
 *
 * Pure TypeScript, no React, no DOM — runs on the main thread, in a Web
 * Worker, and under Vitest unchanged.
 */
import { stemmer } from "stemmer";
import { ENGLISH_STOPWORDS } from "./defaults";
import type { PipelineOptions, TermDoc, TermStats, Ticket } from "./types";

/** Named HTML entities seen in ticket exports. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Lowercase + strip HTML/URLs/emails/timestamps/incident numbers/noise. */
export function cleanText(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = String(raw).toLowerCase();
  // strip HTML tags
  text = text.replace(/<[^>]*>/g, " ");
  // decode/remove entities
  text = text.replace(/&[a-z]+;|&#\d+;/g, (m) => ENTITIES[m] ?? " ");
  // URLs and emails
  text = text.replace(/https?:\/\/\S+|www\.\S+/g, " ");
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ");
  // ISO-ish timestamps and dates, times like 14:30(:00)
  text = text.replace(/\d{4}-\d{2}-\d{2}([ t]\d{2}:\d{2}(:\d{2})?)?/g, " ");
  text = text.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ");
  // bare incident numbers
  text = text.replace(/\binc\d+\b/g, " ");
  // ServiceNow journal separators and similar artifacts
  text = text.replace(/::/g, " ");
  return text;
}

/**
 * Tokenize: words made of letters/digits, keeping intra-word hyphens and
 * apostrophes (re-image, won't). Standalone numbers are dropped.
 */
export function tokenize(text: string): string[] {
  const matches = text.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
  return matches.filter((t) => !/^\d+$/.test(t) && !/^[\d-]+$/.test(t));
}

export interface CompiledPipeline {
  stopwords: Set<string>;
  synonyms: Record<string, string>;
  phraseSet: Set<string>; // "word word" bigrams
}

/** Pre-compile option lists into fast lookup structures. */
export function compilePipeline(
  options: PipelineOptions,
  detectedPhrases: string[] = []
): CompiledPipeline {
  const stopwords = new Set<string>();
  for (const w of [...ENGLISH_STOPWORDS, ...options.customStopwords]) {
    const lw = w.trim().toLowerCase();
    if (!lw) continue;
    stopwords.add(lw);
    stopwords.add(stemmer(lw)); // catch inflected forms (confirms -> confirm)
  }
  const synonyms: Record<string, string> = {};
  for (const [k, v] of Object.entries(options.synonyms)) {
    const key = k.trim().toLowerCase();
    if (key) synonyms[key] = v.trim().toLowerCase();
  }
  const phraseSet = new Set<string>();
  if (options.phrasesEnabled) {
    for (const p of [...options.phrases, ...detectedPhrases]) {
      const norm = p.trim().toLowerCase().split(/\s+/).join(" ");
      if (norm.includes(" ")) phraseSet.add(norm);
    }
  }
  return { stopwords, synonyms, phraseSet };
}

/** Apply the synonym map to a single token (may return a multi-word phrase). */
function applySynonym(token: string, synonyms: Record<string, string>): string {
  return synonyms[token] ?? token;
}

/**
 * Normalize one token to its node id: synonym -> stem -> synonym again.
 * Phrases (containing a space) are passed through untouched. Tokens of three
 * characters or fewer are not stemmed — IT text is full of acronyms that the
 * stemmer would mangle (dns -> dn, sso -> sso is fine but iis -> ii, ...).
 */
export function normalizeToken(token: string, compiled: CompiledPipeline): string {
  let t = applySynonym(token, compiled.synonyms);
  if (t.includes(" ")) return t;
  if (t.length > 3) t = stemmer(t);
  t = applySynonym(t, compiled.synonyms);
  return t;
}

/**
 * Process one document into its final ordered token list.
 * Also reports surface forms so callers can build display labels.
 */
export function processDocument(
  text: string,
  compiled: CompiledPipeline,
  surfaceForms?: Map<string, Map<string, number>>
): string[] {
  const rawTokens = tokenize(cleanText(text));

  // synonym pass (token level; may produce multi-word phrases)
  const tokens: string[] = [];
  for (const tok of rawTokens) {
    const mapped = applySynonym(tok, compiled.synonyms);
    if (mapped.includes(" ")) tokens.push(...mapped.split(" "));
    else tokens.push(mapped);
  }

  // greedy left-to-right bigram merge against the phrase set
  const merged: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i + 1 < tokens.length && compiled.phraseSet.has(`${tokens[i]} ${tokens[i + 1]}`)) {
      merged.push(`${tokens[i]} ${tokens[i + 1]}`);
      i++;
    } else {
      merged.push(tokens[i]);
    }
  }

  // stop-words + stemming
  const out: string[] = [];
  for (const tok of merged) {
    if (tok.includes(" ")) {
      // phrase node — keep as-is
      out.push(tok);
      recordSurface(surfaceForms, tok, tok);
      continue;
    }
    if (tok.length < 2) continue;
    if (compiled.stopwords.has(tok)) continue;
    const norm = normalizeToken(tok, compiled);
    if (norm.length < 2) continue;
    if (compiled.stopwords.has(norm)) continue;
    out.push(norm);
    recordSurface(surfaceForms, norm, tok);
  }
  return out;
}

function recordSurface(
  surfaceForms: Map<string, Map<string, number>> | undefined,
  norm: string,
  surface: string
) {
  if (!surfaceForms) return;
  let forms = surfaceForms.get(norm);
  if (!forms) {
    forms = new Map();
    surfaceForms.set(norm, forms);
  }
  forms.set(surface, (forms.get(surface) ?? 0) + 1);
}

/** Concatenate the selected text columns of a ticket into one document. */
export function assembleDocument(ticket: Ticket, textColumns: string[]): string {
  return textColumns
    .map((c) => ticket[c] ?? "")
    .filter(Boolean)
    .join(". ");
}

/**
 * Detect adjacent word pairs to auto-promote into phrases. A pair must be
 * frequent AND cohesive — cohesion is the pair count over the geometric mean
 * of the word counts (a normalized-PMI-style score). True compounds like
 * "xerox mfp" pass; a hub word with one popular neighbor ("outlook web")
 * does not, so "outlook" keeps its own node.
 */
const PHRASE_COHESION = 0.75;

export function detectPhrases(
  tickets: Ticket[],
  options: PipelineOptions,
  compiled: CompiledPipeline
): string[] {
  if (!options.phrasesEnabled || !options.autoPhrases) return [];
  const pairCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  for (const ticket of tickets) {
    const tokens = tokenize(cleanText(assembleDocument(ticket, options.textColumns)));
    for (let i = 0; i < tokens.length; i++) {
      const a = tokens[i];
      if (a.length < 2 || compiled.stopwords.has(a) || compiled.synonyms[a]?.includes(" ")) {
        continue;
      }
      wordCounts.set(a, (wordCounts.get(a) ?? 0) + 1);
      if (i + 1 < tokens.length) {
        const b = tokens[i + 1];
        if (b.length < 2 || compiled.stopwords.has(b) || compiled.synonyms[b]?.includes(" ")) {
          continue;
        }
        pairCounts.set(`${a} ${b}`, (pairCounts.get(`${a} ${b}`) ?? 0) + 1);
      }
    }
  }
  const detected: string[] = [];
  for (const [pair, n] of pairCounts) {
    if (n < options.autoPhraseMinCount || compiled.phraseSet.has(pair)) continue;
    const [a, b] = pair.split(" ");
    const ca = wordCounts.get(a) ?? n;
    const cb = wordCounts.get(b) ?? n;
    const cohesion = n / Math.sqrt(ca * cb);
    if (cohesion >= PHRASE_COHESION) detected.push(pair);
  }
  return detected.sort();
}

export interface PipelineResult {
  docs: TermDoc[];
  termStats: Map<string, TermStats>;
  detectedPhrases: string[];
}

/** Run the full pipeline over a (filtered) ticket population. */
export function runPipeline(tickets: Ticket[], options: PipelineOptions): PipelineResult {
  const seedCompiled = compilePipeline(options);
  const detectedPhrases = detectPhrases(tickets, options, seedCompiled);
  const compiled = compilePipeline(options, detectedPhrases);

  const surfaceForms = new Map<string, Map<string, number>>();
  const docs: TermDoc[] = [];
  const termTickets = new Map<string, Set<string>>();

  for (const ticket of tickets) {
    if (!ticket.ticket_id) continue;
    const text = assembleDocument(ticket, options.textColumns);
    const tokens = processDocument(text, compiled, surfaceForms);
    if (tokens.length === 0) continue;
    const terms = [...new Set(tokens)];
    docs.push({ ticketId: ticket.ticket_id, tokens, terms });
    for (const term of terms) {
      let set = termTickets.get(term);
      if (!set) {
        set = new Set();
        termTickets.set(term, set);
      }
      set.add(ticket.ticket_id);
    }
  }

  const termStats = new Map<string, TermStats>();
  for (const [term, ids] of termTickets) {
    termStats.set(term, {
      term,
      label: bestLabel(term, surfaceForms.get(term)),
      freq: ids.size,
      ticketIds: [...ids],
    });
  }

  return { docs, termStats, detectedPhrases };
}

/** Display label = most frequent surface form for the normalized term. */
function bestLabel(term: string, forms?: Map<string, number>): string {
  if (!forms || forms.size === 0) return term;
  let best = term;
  let bestCount = -1;
  for (const [surface, count] of forms) {
    if (count > bestCount || (count === bestCount && surface.length < best.length)) {
      best = surface;
      bestCount = count;
    }
  }
  return best;
}
