// ---------------------------------------------------------------------------
// Runtime configuration for the live data sources.
//
// Reads from environment variables (loaded from server/.env and the repo-root
// .env). With no .env, LIVE_DATA defaults to false and the app serves the
// synthetic demo data exactly as before. Set LIVE_DATA=true (see .env.example)
// to fan out to the real Norwegian sources.
// ---------------------------------------------------------------------------

import dotenv from "dotenv";

// server/.env first, then repo-root ../.env as a fallback.
dotenv.config();
dotenv.config({ path: "../.env" });

const bw = {
  clientId: process.env.BARENTSWATCH_CLIENT_ID ?? "",
  clientSecret: process.env.BARENTSWATCH_CLIENT_SECRET ?? "",
};

export const config = {
  /** Master switch. When false, everything is synthetic demo data. */
  liveData: (process.env.LIVE_DATA ?? "false").toLowerCase() === "true",

  /** MET requires an identifying User-Agent on every request. */
  metUserAgent:
    process.env.MET_USER_AGENT ??
    "Kystkonsulent/0.1 (https://github.com/kystkonsulent)",

  /** Optional — enables Frost as the preferred temperature source. */
  frostClientId: process.env.FROST_CLIENT_ID ?? "",

  barentswatch: bw,

  /** Naturbase / Miljødirektoratet protected-areas ArcGIS layer (point query). */
  protectedAreasUrl:
    process.env.PROTECTED_AREAS_URL ??
    "https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer/0",

  /** Bathymetry via OpenTopoData (GEBCO dataset) — a simple JSON elevation API
   * that returns real depths (negative elevation = below sea level) and supports
   * batched point queries. Public instance is rate-limited (~1 req/s, 1000/day);
   * point it at a self-hosted instance for heavy use. */
  bathymetry: {
    url: process.env.OPENTOPODATA_URL ?? "https://api.opentopodata.org/v1",
    dataset: process.env.BATHYMETRY_DATASET ?? "gebco2020",
  },

  /** Per-request timeout for any single source call. */
  timeoutMs: Number(process.env.SOURCE_TIMEOUT_MS) || 6000,

  /** How long live facts for a point are reused (ms). Default 30 min. */
  factsCacheTtlMs: Number(process.env.FACTS_CACHE_TTL_MS) || 30 * 60 * 1000,

  /** In a live scan, how many top synthetic candidates to verify with the APIs
   * (the pool we then filter down to real water sites). */
  scanPool: Number(process.env.SCAN_POOL) || 20,

  /** Max water sites to return in the live shortlist. */
  scanShortlist: Number(process.env.SCAN_SHORTLIST) || 15,

  /** Max concurrent live fetches during a scan. */
  scanConcurrency: Number(process.env.SCAN_CONCURRENCY) || 8,
};

/** Which sources should actually be attempted, given the config. */
export const sourcesEnabled = {
  protectedArea: config.liveData,
  depth: config.liveData,
  temperature: config.liveData,
  waves: config.liveData,
  shipping: config.liveData && !!bw.clientId && !!bw.clientSecret,
};
