# Kystkonsulent — Marine Siting Screening Tool

> *"From idea to a defensible shortlist of viable sites in seconds — then hand it
> to your surveyor with confidence."*

A web tool that screens the Norwegian coast for marine projects (seaweed/kelp
farms, salmon aquaculture, sensor buoys). Pick a project type and a location —
click a point, or search a place and scan a radius — and the tool collects
measured facts about that location and scores them against an **editable,
per-project rubric** to produce a transparent 0–100 suitability score with a
factor-by-factor breakdown.

This is the **thin vertical slice** from the build brief: the full scoring engine,
all **three input modes** (click a point · scan an area · describe a project),
the editable rubric, and the persistent scope disclaimer. It runs on synthetic
demo data out of the box, and connects to the real Norwegian sources when you
add a `.env` (see [Live data](#live-data)) — each fact is tagged **live** or
**demo** in the UI.

### Input modes (spec §4)

1. **Click a point** — one coordinate → one full site report.
2. **Scan an area** — place search + radius (10/30/50 km) lays a grid, scores every
   candidate, and returns a ranked shortlist + a coloured-dot heatmap.
3. **Describe a project** — a plain-language brief ("2-hectare mussel farm near
   Bergen, budget-sensitive") is parsed into a project type, an editable rubric, and
   a region, then the area scan runs. Every inferred choice is shown for transparency.

## Core concept: facts vs. criteria

The UI keeps two kinds of numbers visually distinct:

- **🔒 Measured facts (read-only):** depth, temperature, wave height, protected-area
  flag, shipping traffic — these come from the data APIs and cannot be edited.
- **✏️ Your criteria (editable):** acceptable ranges, thresholds, weights, and
  hard-exclusion rules — these are *your requirements*, not facts.

**Score = measured facts evaluated against your criteria.** Disagreeing with a
score means adjusting your requirements, not disputing the data.

## Quick start

```bash
npm install        # installs the server + web workspaces
npm run dev        # runs API (:5174) and the web app (:5173) together
```

Open <http://localhost:5173>. The web dev server proxies `/api/*` to the API.

Other scripts:

```bash
npm run build      # type-check + build both packages
npm run dev:server # API only
npm run dev:web    # web only
```

## Architecture

```
server/   Express + TypeScript API
  scoring.ts   the scoring engine (band() + score()) — spec §5
  rubrics.ts   locked default rubrics per project type
  config.ts    env-driven live-data config + feature flags
  facts.ts     orchestrates live sources over a synthetic baseline (+ provenance)
  sources/     one module per live source (depth, temperature, waves, …)
  geocode.ts   place search — live Kartverket Stedsnavn, mock fallback
  scan.ts      grid-scan engine for area mode (synthetic, fast)
  index.ts     routes: /evaluate /scan /describe /geocode /config /diagnostics

web/      React + Vite + TypeScript + Leaflet
  App.tsx               state, live re-scoring, mode handling
  scoring.ts            client mirror of the engine for instant live edits
  components/MapView    Leaflet map, Kartverket tiles, click + scan dots
  components/ReportPanel single-site report (score, facts, breakdown)
  components/CriteriaEditor  editable rubric (the "your criteria" block)
  components/ScanList   ranked shortlist for area mode
  components/DescribeIntake  natural-language brief → interpretation + scan
```

The intake parser (`server/src/intake.ts`) is a **deterministic, transparent
rule-based parser** — it detects the project type, region, radius, and rubric
tweaks from the text and records a note for every inference. It runs offline with
no external dependency. An LLM backend can drop in behind the same `IntakeResult`
contract (emit the same shape from a model call), exactly as the facts layer is
structured for swapping in live APIs.

### API

| Method | Endpoint            | Body / Query                                  | Returns      |
|--------|---------------------|-----------------------------------------------|--------------|
| POST   | `/api/evaluate`     | `{ lat, lng, projectType, rubric? }`          | `SiteReport` |
| POST   | `/api/scan`         | `{ center:{lat,lng}, radiusKm, projectType, rubric? }` | `ScanResult` |
| POST   | `/api/describe`     | `{ text }`                                     | `IntakeResult` |
| GET    | `/api/project-types`| —                                             | `ProjectType[]` |
| GET    | `/api/geocode`      | `?q=Florø`                                     | `GeocodeHit[]` |
| GET    | `/api/health`       | —                                             | status       |

## Scoring engine (spec §5)

- Hard exclusions (e.g. inside a protected area) → instant fail, score 0.
- Each factor's fit is `band(value, lo, hi)`: `1.0` inside the range, falling off
  linearly to `0` at `0.6 × span` beyond the edge.
- Weighted average of the fits, then soft penalties multiply the score down
  (e.g. ×0.7 near a shipping lane).
- Verdict: `≥70` Recommended · `45–69` Marginal · `<45` Poor fit · excluded → Excluded.

Editing the rubric recalculates **every** visible score live, client-side, with no
round-trip (facts never change — only your criteria).

### Default rubrics

| Project | Depth (m) | Temp (°C) | Max wave Hs (m) | Weights D/T/W |
|---------|-----------|-----------|------------------|----------------|
| Seaweed / kelp | 5–40 | 4–16 | 2.0 | 40 / 25 / 35 |
| Salmon aquaculture | 15–60 | 6–18 | 2.5 | 40 / 25 / 35 |
| Sensor buoy | 10–400 | −2 to 25 | 5.0 | 40 / 25 / 35 |

Defaults are locked; editing forks a working copy you can always reset.

## Live data

Single-point evaluation (**Click a point**) fans out to live sources in parallel
when `LIVE_DATA=true`; each fact is tagged **live** or **demo** in the UI.

**Scan** ranks the full grid with the fast synthetic generator, then verifies the
top candidates (`SCAN_LIVE_TOP`, default 12) against the live sources — cached
and concurrency-limited — and re-ranks on the real numbers (spec §7: rank
cheaply, spend live calls only where they matter). Verified sites get a dark ring
on the map and a **live** badge in the list. Live facts are cached per ~100 m
(`FACTS_CACHE_TTL_MS`, default 30 min) so re-clicks and overlapping scans reuse
them. Anything that fails or is unconfigured falls back to synthetic, so the app
always works.

| Fact | Source | Auth |
|------|--------|------|
| Water temperature | MET oceanforecast (`sea_water_temperature`) | none |
| Significant wave height | Open-Meteo Marine (`wave_height`) | none |
| Protected / excluded area | Naturbase / Miljødirektoratet (ArcGIS point query) | none |
| Seafloor depth | EMODnet Bathymetry (WMS GetFeatureInfo) | none |
| Shipping traffic | BarentsWatch AIS | OAuth2 |
| Temperature (optional override) | MET Frost (nearest sea-temp station) | free client id |
| Geocoding (place search) | Kartverket Stedsnavn | none |

### Setup

```bash
cp .env.example .env      # repo root (or server/.env)
# edit .env: set LIVE_DATA=true, a real MET_USER_AGENT, and your
# BARENTSWATCH_CLIENT_ID / BARENTSWATCH_CLIENT_SECRET
npm run dev
```

- **BarentsWatch (shipping):** create a free API client at
  <https://www.barentswatch.no/minside/> and paste id + secret.
- **MET Frost (optional):** request a free client id at
  <https://frost.met.no/auth/requestCredentials.html> to prefer station-based
  temperature. Water temperature works without it (MET oceanforecast).
- The other sources (depth, waves, protected areas, geocoding) need **no
  credentials**.

### Verify your setup

```
GET /api/config                       # which sources are enabled
GET /api/diagnostics?lat=63.4&lng=8.0 # runs every source, reports ok/value/error
```

`/api/diagnostics` is the quickest way to confirm credentials and spot a source
that needs an endpoint tweak (e.g. if EMODnet's layer name or the BarentsWatch
AIS path changes for your account — both are overridable via `.env`).

### Caching for scan mode (future)

To make scans live too, cache the slow-changing layers (depth, protected areas)
and fetch live ocean data only for the top-ranked candidates (spec §7).

## Honest scope

This is **indicative pre-screening to rank candidate sites** — not a substitute
for a physical survey, environmental assessment, or permit. A persistent
disclaimer is shown in the app: data is interpolated and a snapshot in time,
missing layers do not mean all-clear, and the score is a weighted judgement.

## Notes

- The default base map is the clean, pale **CARTO Positron** style (the same
  look as tidevannstabell.no), with Voyager, Kartverket topo, and OpenStreetMap
  available in the layer switcher (top-right of the map). Tiles require outbound
  network access; in a restricted sandbox the map background may appear blank
  while the rest of the UI works normally.
