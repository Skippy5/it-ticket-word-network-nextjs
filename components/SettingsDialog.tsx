"use client";

import { useState } from "react";
import { URL_TEMPLATE_EXAMPLE } from "@/lib/defaults";
import { useSettingsStore } from "@/lib/store";

type Tab = "stopwords" | "synonyms" | "phrases" | "link";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const setPipeline = useSettingsStore((s) => s.setPipeline);
  const urlTemplate = useSettingsStore((s) => s.urlTemplate);
  const setUrlTemplate = useSettingsStore((s) => s.setUrlTemplate);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  const [tab, setTab] = useState<Tab>("stopwords");
  const [newStopword, setNewStopword] = useState("");
  const [newSynKey, setNewSynKey] = useState("");
  const [newSynValue, setNewSynValue] = useState("");
  const [newPhrase, setNewPhrase] = useState("");

  const pl = settings.pipeline;

  function addStopword() {
    const w = newStopword.trim().toLowerCase();
    if (!w || pl.customStopwords.includes(w)) return;
    setPipeline({ customStopwords: [...pl.customStopwords, w].sort() });
    setNewStopword("");
  }

  function addSynonym() {
    const k = newSynKey.trim().toLowerCase();
    const v = newSynValue.trim().toLowerCase();
    if (!k || !v) return;
    setPipeline({ synonyms: { ...pl.synonyms, [k]: v } });
    setNewSynKey("");
    setNewSynValue("");
  }

  function addPhrase() {
    const p = newPhrase.trim().toLowerCase().split(/\s+/).join(" ");
    if (!p.includes(" ") || pl.phrases.includes(p)) return;
    setPipeline({ phrases: [...pl.phrases, p].sort() });
    setNewPhrase("");
  }

  const tabButton = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-t px-3 py-1.5 text-xs font-medium ${
        tab === id
          ? "border border-b-0 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border border-zinc-300 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Pipeline dictionaries</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ✕
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3">
          {tabButton("stopwords", `Stop-words (${pl.customStopwords.length})`)}
          {tabButton("synonyms", `Synonyms (${Object.keys(pl.synonyms).length})`)}
          {tabButton("phrases", `Phrases (${pl.phrases.length})`)}
          {tabButton("link", "Ticket link")}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-zinc-300 p-4 dark:border-zinc-700">
          {tab === "stopwords" && (
            <div>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                IT/ticketing stop-words removed on top of the built-in English list. Changes
                persist in this browser.
              </p>
              <div className="mb-3 flex gap-1.5">
                <input
                  value={newStopword}
                  onChange={(e) => setNewStopword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStopword()}
                  placeholder="add word…"
                  className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button onClick={addStopword} className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pl.customStopwords.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {w}
                    <button
                      onClick={() =>
                        setPipeline({ customStopwords: pl.customStopwords.filter((x) => x !== w) })
                      }
                      className="text-zinc-400 hover:text-red-500"
                      aria-label={`remove ${w}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab === "synonyms" && (
            <div>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Token replacements applied before and after stemming (e.g. <code>pwd → password</code>).
                Multi-word replacements become phrase nodes.
              </p>
              <div className="mb-3 flex gap-1.5">
                <input
                  value={newSynKey}
                  onChange={(e) => setNewSynKey(e.target.value)}
                  placeholder="from (e.g. pwd)"
                  className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                />
                <span className="self-center text-xs text-zinc-400">→</span>
                <input
                  value={newSynValue}
                  onChange={(e) => setNewSynValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSynonym()}
                  placeholder="to (e.g. password)"
                  className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button onClick={addSynonym} className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Add
                </button>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(pl.synonyms)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => (
                      <tr key={k} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-1 font-mono">{k}</td>
                        <td className="px-2 text-zinc-400">→</td>
                        <td className="py-1 font-mono">{v}</td>
                        <td className="py-1 text-right">
                          <button
                            onClick={() => {
                              const next = { ...pl.synonyms };
                              delete next[k];
                              setPipeline({ synonyms: next });
                            }}
                            className="text-zinc-400 hover:text-red-500"
                            aria-label={`remove ${k}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "phrases" && (
            <div>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Bigrams kept together as single nodes (e.g. <code>blue screen</code>). Frequent
                bigrams can also be auto-detected (toggle in the left rail).
              </p>
              <div className="mb-3 flex gap-1.5">
                <input
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPhrase()}
                  placeholder="add two-word phrase…"
                  className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button onClick={addPhrase} className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pl.phrases.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {p}
                    <button
                      onClick={() => setPipeline({ phrases: pl.phrases.filter((x) => x !== p) })}
                      className="text-zinc-400 hover:text-red-500"
                      aria-label={`remove ${p}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab === "link" && (
            <div>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Optional URL template for incident links in the evidence panel.{" "}
                <code>{"{ticket_id}"}</code> is replaced with the incident number.
              </p>
              <input
                value={urlTemplate}
                onChange={(e) => setUrlTemplate(e.target.value)}
                placeholder={URL_TEMPLATE_EXAMPLE}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <button
            onClick={resetSettings}
            className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Reset all settings to defaults
          </button>
          <button
            onClick={onClose}
            className="rounded bg-blue-600 px-4 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
