# IT Ticket Word Network

An interactive **word co-occurrence network** for IT tickets. Upload a ticket CSV
(e.g. a ServiceNow export), and the app strips stop-words, normalizes terms,
detects multi-word phrases, computes term co-occurrence, clusters related words
(Louvain communities), and draws a force-directed network so you can see problem
groupings — *outlook ↔ email, mailbox, sync*; *print ↔ jam, toner, queue* — and
drill from any node or edge back to the exact incident numbers behind it.

**Everything runs client-side in your browser.** CSV parsing, the text pipeline,
co-occurrence counting, clustering and rendering all happen locally (in a Web
Worker where it matters). Uploaded ticket data never leaves your machine; there
is no backend, no database, and no API routes.

## Features

- **CSV upload** (multiple files merge by `ticket_id`) with case-insensitive
  header matching, HTML/noise tolerance, and in-UI warnings for missing columns.
- **Filters before computation**: business unit, location, country, state,
  category, assignment group, priority, status, and an opened-at date range.
  Geography cascades (country → state → location) and orphaned selections are
  dropped. Live scope count + one-click reset.
- **Text pipeline** (`lib/pipeline.ts`, unit-tested): lowercase → strip
  HTML/URLs/emails/timestamps/`INC…` numbers → tokenize (intra-word hyphens
  kept) → editable synonym/abbreviation map (`pwd→password`,
  `dl→distribution list`, …) → English + editable IT stop-words → light
  stemming (Porter2; acronyms ≤3 chars protected) → seed + auto-detected
  bigram phrases (`blue screen`, `network drive`, …).
- **Co-occurrence** (`lib/cooccurrence.ts`): document-level by default, optional
  sliding window; raw counts and positive PMI weighting; pruning by min term
  frequency, min edge count, top-N terms.
- **Clustering** (`lib/clustering.ts`): graphology + Louvain with seeded RNG —
  deterministic, comparable runs. Cluster legend + per-cluster term lists.
- **Drill-in**: click a node → every incident containing the term; click an
  edge → the incidents where both terms co-occur, with the matched terms
  highlighted. Incident IDs are copyable and optionally linked via a
  configurable URL template. Hover for term/frequency/cluster/top-neighbors.
- **Exports**: node list, edge list (including co-occurring incident IDs per
  edge), filtered incident list (CSV), full graph (JSON).
- **Light & dark mode** with OS-preference default and a header toggle.
- Settings (stop-words, synonyms, phrases, URL template, tuning) persist to
  `localStorage` — the only persistence in the app.

## Renderer choice

The graph is drawn with **react-force-graph-2d** (canvas). Reasons: it handles
hundreds of nodes smoothly on a single canvas, ships first-class **edge click +
hover** callbacks (edge drill-in is a core requirement), supports zoom/pan/drag
and physics freeze, and has a tiny React API. Sigma.js v3 pairs more natively
with graphology but its edge interaction story and custom node painting require
more glue; d3-force alone means hand-rolling hit-testing. The renderer is
imported with `next/dynamic` + `ssr: false`, which keeps static export working.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest unit tests for the pipeline + co-occurrence math
```

Load a bundled dataset via **Demo data** (samples live in `public/samples/`),
or upload your own CSV with the columns described below.

## Input data contract

| Column | Role |
|---|---|
| `ticket_id` | incident number — drill-in key (required) |
| `short_description`, `work_notes`, `close_notes` | text sources (selectable) |
| `business_unit`, `location`, `country`, `state` | filters |
| `category`, `subcategory`, `assignment_group`, `priority`, `status`, `opened_at` | metadata / bonus filters |

Extra columns are kept as pass-through metadata. Headers are matched
case-insensitively. Blank cells, HTML fragments and stray encodings are
tolerated.

## Deployment

The app is plain Next.js (App Router, TypeScript) with **no Vercel-proprietary
services** and no server-side data work, so it runs identically on Vercel, a
Node server, Docker, or any static file host. The output mode is selected with
the `NEXT_OUTPUT` environment variable (see `next.config.mjs`) — no code
changes between targets.

### 1. Vercel (GitHub import)

1. Push this repo to GitHub:
   ```bash
   git init && git add -A && git commit -m "initial"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In Vercel: **Add New → Project → Import** the GitHub repo.
3. Accept the defaults (framework auto-detected as Next.js). No environment
   variables, no `vercel.json`, zero custom configuration. Deploy.

### 2. Node server (AWS EC2 / Lightsail / anywhere)

```bash
npm ci
npm run build
npm start            # serves on :3000
```

### 3. Docker on AWS

Multi-stage build using Next.js standalone output:

```bash
docker build -t ticket-network .
docker run -p 3000:3000 ticket-network
```

### 4. Static export (S3 + CloudFront / nginx)

```bash
npm run build:static   # NEXT_OUTPUT=export next build -> ./out
npx serve out          # local check
```

- **S3/CloudFront**: upload `out/` to the bucket, point CloudFront at it,
  set the default root object to `index.html`.
- **nginx**: `root /var/www/ticket-network/out;` — no special config needed.

> The only build-time toggle is `NEXT_OUTPUT` (`standalone` for Docker,
> `export` for static). Unset, you get the regular server build that Vercel
> and `npm start` use. The app itself is identical in all three modes because
> all data processing is client-side.

## Repo layout

```
app/                     # Next.js App Router (page, layout, globals)
components/              # Header, FilterRail, GraphPanel/GraphView,
                         # EvidencePanel, SettingsDialog, MultiSelect, …
lib/
  pipeline.ts            # clean → tokenize → synonyms → stopwords → stem → phrases
  cooccurrence.ts        # pair counts, PMI, pruning
  clustering.ts          # graphology + seeded Louvain
  drilldown.ts           # term→incidents, edge→incidents, URL template
  computeGraph.ts        # end-to-end orchestration (used by worker + fallback)
  csv.ts                 # PapaParse loading + header normalization + warnings
  filters.ts             # faceted filters with geographic cascade
  exports.ts             # CSV/JSON exports
  store.ts               # Zustand stores (data; persisted settings)
workers/pipeline.worker.ts  # off-main-thread computation
public/samples/          # four demo CSVs (small / large / multidept / messy)
__tests__/               # Vitest: pipeline + co-occurrence/PMI/drill-in
Dockerfile               # multi-stage, standalone output
next.config.mjs          # NEXT_OUTPUT toggle (server / standalone / export)
```

## Tuning parameters (left rail)

Text columns · co-occurrence scope (ticket vs sliding window + size) ·
edge weighting (count vs PMI) · min term frequency · min edge count ·
max terms · Louvain resolution · phrase handling (seed list + auto-detect)
· layout physics on/off · editable stop-words / synonyms / phrases ·
incident URL template.

Defaults (minFreq 5 · minEdge 4 · maxTerms 100 · resolution 1.4) are tuned to
render six readable clusters (email/Outlook, printing, network/VPN,
account/access, hardware, software) on the ~100–320-ticket sample datasets.
If a small or heavily filtered population prunes to nothing, the canvas tells
you which thresholds to lower.
