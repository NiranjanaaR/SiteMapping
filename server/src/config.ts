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

  /** Bathymetry WMS (GetFeatureInfo). EMODnet by default. */
  bathymetry: {
    wmsUrl:
      process.env.BATHYMETRY_WMS_URL ?? "https://ows.emodnet-bathymetry.eu/wms",
    layer: process.env.BATHYMETRY_WMS_LAYER ?? "emodnet:mean_atlas_land",
  },

  /** Per-request timeout for any single source call. */
  timeoutMs: Number(process.env.SOURCE_TIMEOUT_MS) || 6000,
};

/** Which sources should actually be attempted, given the config. */
export const sourcesEnabled = {
  protectedArea: config.liveData,
  depth: config.liveData,
  temperature: config.liveData,
  waves: config.liveData,
  shipping: config.liveData && !!bw.clientId && !!bw.clientSecret,
};
