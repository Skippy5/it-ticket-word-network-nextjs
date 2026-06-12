import type { GraphSettings } from "./types";

/** Base English stop-word list (always applied; not editable in the UI). */
export const ENGLISH_STOPWORDS: string[] = [
  "a", "about", "above", "after", "again", "against", "all", "also", "am", "an",
  "and", "any", "are", "aren't", "as", "at", "back", "be", "because", "been",
  "before", "being", "below", "between", "both", "but", "by", "can", "cannot",
  "can't", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
  "doing", "don't", "down", "during", "each", "few", "for", "from", "further",
  "get", "got", "had", "hadn't", "has", "hasn't", "have", "haven't", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i",
  "if", "in", "into", "is", "isn't", "it", "its", "itself", "just", "let",
  "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "now",
  "of", "off", "on", "once", "only", "onto", "or", "other", "ought", "our",
  "ours", "ourselves", "out", "over", "own", "per", "same", "shan't", "she",
  "should", "shouldn't", "so", "some", "such", "than", "that", "that's",
  "the", "their", "theirs", "them", "themselves", "then", "there", "these",
  "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "upon", "us", "very", "was", "wasn't", "we", "were", "weren't", "what",
  "when", "where", "which", "while", "who", "whom", "why", "will", "with",
  "without", "won't", "would", "wouldn't", "you", "your", "yours", "yourself",
  "yourselves", "via", "etc", "ok", "okay", "yes", "well", "still", "since",
  "able", "across",
];

/**
 * Editable IT/ticketing stop-words — seeded per the spec, user can add/remove
 * at runtime (persisted to localStorage).
 */
export const DEFAULT_IT_STOPWORDS: string[] = [
  "user", "please", "thanks", "ticket", "incident", "issue", "resolved",
  "closed", "called", "advised", "regards", "hi", "hello", "team", "am", "pm",
  "eod", "fyi", "confirmed", "verified", "checked",
  // generic ticket-resolution boilerplate that otherwise dominates the network
  "applied", "back", "causing", "cleared", "closing", "fixed", "found",
  "inspected", "normal", "replaced", "reported", "reports", "restored",
  "stable", "successfully", "suspected", "traced", "updated", "working",
];

/**
 * Synonym / abbreviation map. Token-level; replacement may be multi-word
 * (it then behaves like a phrase node). Applied both before and after
 * stemming so families like printer/printing/printers collapse.
 */
export const DEFAULT_SYNONYMS: Record<string, string> = {
  pwd: "password",
  passwd: "password",
  dl: "distribution list",
  m365: "microsoft 365",
  o365: "microsoft 365",
  ad: "active directory",
  config: "configuration",
  "re-installed": "reinstall",
  "re-install": "reinstall",
  "re-imaged": "reimage",
  "re-image": "reimage",
  reinstalled: "reinstall",
  printer: "print",
  printers: "print",
  teh: "the",
  conection: "connection",
  wifi: "wi-fi",
  email: "email",
  emails: "email",
  "e-mail": "email",
};

/** Seed bigram phrases that stay together as a single node. */
export const DEFAULT_PHRASES: string[] = [
  "distribution list",
  "blue screen",
  "active directory",
  "network drive",
  "docking station",
  "microsoft 365",
  "shared inbox",
  "meeting invite",
  "access point",
  "switch port",
  "print server",
  "print spooler",
  "print queue",
  "default printer",
  "paper jam",
  "paper tray",
  "toner cartridge",
  "print driver",
  "display cable",
  "display driver",
  "wireless driver",
  "power adapter",
  "hard drive",
  "fan vents",
  "dhcp lease",
  "dns cache",
  "dns record",
  "ip address",
  "network adapter",
  "security group",
  "vpn client",
  "vpn portal",
  "mfa token",
  "test page",
  "new starter",
  "network printer",
  "stress test",
  "security gateway",
  "line-of-business app",
  "usb port",
];

export const DEFAULT_URL_TEMPLATE = "";
export const URL_TEMPLATE_EXAMPLE =
  "https://servicenow.mycorp.com/incident.do?sysparm_query=number={ticket_id}";

export const DEFAULT_SETTINGS: GraphSettings = {
  pipeline: {
    textColumns: ["short_description", "work_notes", "close_notes"],
    customStopwords: DEFAULT_IT_STOPWORDS,
    synonyms: DEFAULT_SYNONYMS,
    phrases: DEFAULT_PHRASES,
    phrasesEnabled: true,
    autoPhrases: true,
    autoPhraseMinCount: 8,
  },
  // Tuned on the bundled ~90–320-ticket samples: six readable clusters
  // (email, printing, network/VPN, access, hardware, software). All adjustable.
  cooccurrence: {
    scope: "document",
    windowSize: 10,
    weighting: "count",
    minFreq: 5,
    minEdge: 4,
    maxTerms: 100,
  },
  clustering: {
    resolution: 1.4,
    seed: 42,
  },
};

/** Categorical palette that reads well on both light and dark backgrounds. */
export const CLUSTER_COLORS = [
  "#4f8ef7", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#a78bfa", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#e879f9", // fuchsia
  "#facc15", // yellow
] as const;

export function communityColor(community: number): string {
  return CLUSTER_COLORS[((community % CLUSTER_COLORS.length) + CLUSTER_COLORS.length) % CLUSTER_COLORS.length];
}
