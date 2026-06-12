import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import {
  cleanText,
  compilePipeline,
  processDocument,
  runPipeline,
  tokenize,
} from "../lib/pipeline";
import type { PipelineOptions, Ticket } from "../lib/types";

const baseOptions: PipelineOptions = {
  ...DEFAULT_SETTINGS.pipeline,
  autoPhrases: false, // deterministic tests against the seed list only
};

function ticket(id: string, text: string): Ticket {
  return { ticket_id: id, short_description: text };
}

describe("cleanText", () => {
  it("strips HTML tags and entities", () => {
    expect(cleanText("<div>Printer&nbsp;offline</div><br>")).toContain("printer offline");
    expect(cleanText("<p>VPN &amp; DNS</p>")).not.toContain("<");
    expect(cleanText("&nbsp;REPLACE SCREEN")).toContain("replace screen");
  });

  it("removes URLs, emails, timestamps and incident numbers", () => {
    const out = cleanText(
      "See https://kb.corp/article INC0002095 mailto bob@corp.com at 2025-01-08 07:41"
    );
    expect(out).not.toMatch(/https|inc\d+|@|2025|07:41/);
  });

  it("handles null/undefined without crashing", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("tokenize", () => {
  it("keeps intra-word hyphens and drops standalone numbers", () => {
    expect(tokenize("re-image the laptop 49 times")).toEqual([
      "re-image",
      "the",
      "laptop",
      "times",
    ]);
  });
});

describe("processDocument", () => {
  const compiled = compilePipeline(baseOptions);

  it("collapses synonyms: pwd -> password", () => {
    const tokens = processDocument("User forgot pwd", compiled);
    expect(tokens).toContain("password");
    expect(tokens).not.toContain("pwd");
  });

  it("expands dl -> distribution list as a phrase node", () => {
    const tokens = processDocument("add member to DL", compiled);
    expect(tokens).toContain("distribution list");
  });

  it("preserves seed phrases as single nodes", () => {
    const tokens = processDocument("laptop shows blue screen after docking station change", compiled);
    expect(tokens).toContain("blue screen");
    expect(tokens).toContain("docking station");
    expect(tokens).not.toContain("blue");
  });

  it("removes English and IT stop-words (including inflections)", () => {
    const tokens = processDocument("the user confirms the issue is resolved", compiled);
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("user");
    expect(tokens).not.toContain("confirm"); // "confirmed" seeded -> stem covers "confirms"
    expect(tokens).not.toContain("resolv");
  });

  it("stems word families together: connecting/connection/connectivity -> connect", () => {
    const a = processDocument("connecting fails", compiled);
    const b = processDocument("connection fails", compiled);
    const c = processDocument("connectivity fails", compiled);
    expect(a[0]).toBe(b[0]);
    expect(b[0]).toBe(c[0]);
  });

  it("maps printing/printers/printer to one node", () => {
    const a = processDocument("printing broken", compiled);
    const b = processDocument("printers broken", compiled);
    const c = processDocument("printer broken", compiled);
    expect(new Set([a[0], b[0], c[0]]).size).toBe(1);
  });
});

describe("runPipeline", () => {
  it("retains the set of ticket ids per term (traceability)", () => {
    const result = runPipeline(
      [
        ticket("INC1", "Outlook crash"),
        ticket("INC2", "outlook slow again"),
        ticket("INC3", "VPN dropping"),
      ],
      baseOptions
    );
    const outlook = result.termStats.get("outlook");
    expect(outlook).toBeDefined();
    expect(outlook!.ticketIds.sort()).toEqual(["INC1", "INC2"]);
    expect(outlook!.freq).toBe(2);
  });

  it("skips tickets without usable text but never drops ids with text", () => {
    const result = runPipeline(
      [ticket("INC1", ""), ticket("INC2", "printer jam")],
      baseOptions
    );
    expect(result.docs.map((d) => d.ticketId)).toEqual(["INC2"]);
  });

  it("uses the most frequent surface form as the display label", () => {
    const result = runPipeline(
      [ticket("A", "password reset"), ticket("B", "password expired"), ticket("C", "passwords list")],
      baseOptions
    );
    const stats = result.termStats.get("password");
    expect(stats?.label).toBe("password");
  });
});
