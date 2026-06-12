"use client";

import { useEffect, useRef, useState } from "react";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange(values: string[]): void;
}

/** Compact multi-select dropdown with checkboxes and optional search. */
export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const visible = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggleValue(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left text-xs ${
          selected.length > 0
            ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950"
            : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800"
        }`}
      >
        <span className="truncate">
          {label}
          {selected.length > 0 && (
            <span className="ml-1 font-semibold text-blue-700 dark:text-blue-300">
              ({selected.length})
            </span>
          )}
        </span>
        <span className="ml-1 text-zinc-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full min-w-44 overflow-auto rounded border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {options.length > 8 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search…"
              className="sticky top-0 w-full border-b border-zinc-200 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
          )}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="block w-full border-b border-zinc-200 px-2 py-1 text-left text-xs text-blue-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-blue-400 dark:hover:bg-zinc-700"
            >
              clear ({selected.length})
            </button>
          )}
          {visible.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-zinc-400">no options</div>
          )}
          {visible.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleValue(opt)}
                className="accent-blue-600"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
