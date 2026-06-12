"use client";

/**
 * Highlight occurrences of network terms inside raw ticket text. Tokens are
 * normalized with the same pipeline rules (synonyms + stemming) so "printing"
 * lights up for the node "print", and phrase nodes match word pairs.
 */
import React from "react";
import { normalizeToken, type CompiledPipeline } from "@/lib/pipeline";

interface TokenSpan {
  start: number;
  end: number;
}

export function highlightTerms(
  text: string,
  targets: string[],
  compiled: CompiledPipeline
): React.ReactNode {
  if (!text) return text;
  const targetSet = new Set(targets);
  const tokenRe = /[a-z0-9]+(?:['-][a-z0-9]+)*/gi;
  const tokens: { raw: string; span: TokenSpan }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(text)) !== null) {
    tokens.push({ raw: m[0].toLowerCase(), span: { start: m.index, end: m.index + m[0].length } });
  }

  const marks: TokenSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    // phrase match on adjacent pair (after synonym mapping)
    if (i + 1 < tokens.length) {
      const a = compiled.synonyms[tokens[i].raw] ?? tokens[i].raw;
      const b = compiled.synonyms[tokens[i + 1].raw] ?? tokens[i + 1].raw;
      if (targetSet.has(`${a} ${b}`)) {
        marks.push({ start: tokens[i].span.start, end: tokens[i + 1].span.end });
        i++;
        continue;
      }
    }
    const norm = normalizeToken(tokens[i].raw, compiled);
    if (targetSet.has(norm)) marks.push(tokens[i].span);
  }

  if (marks.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((span, idx) => {
    if (span.start > cursor) parts.push(text.slice(cursor, span.start));
    parts.push(
      <mark
        key={idx}
        className="rounded bg-amber-200 px-0.5 text-zinc-900 dark:bg-amber-500/40 dark:text-amber-100"
      >
        {text.slice(span.start, span.end)}
      </mark>
    );
    cursor = span.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
