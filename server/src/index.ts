// ---------------------------------------------------------------------------
// Kystkonsulent API service (spec §7).
//
//   POST /api/evaluate   { lat, lng, projectType, rubric? }  -> SiteReport
//   POST /api/scan       { center, radiusKm, projectType, rubric? } -> ScanResult
//   POST /api/describe   { text }                            -> IntakeResult
//   GET  /api/project-types                                  -> ProjectType[]
//   GET  /api/geocode?q=...                                  -> GeocodeHit[]
//   GET  /api/config                                         -> { liveData, sourcesEnabled }
//   GET  /api/diagnostics?lat=&lng=                          -> per-source status
//   GET  /api/health
//
// Single-point evaluation fans out to the live Norwegian sources (when
// LIVE_DATA is on); area scans use the fast synthetic generator. Everything
// falls back to synthetic so the UI works with or without live data.
// ---------------------------------------------------------------------------

import cors from "cors";
import express from "express";
import { config, sourcesEnabled } from "./config.js";
import { getFacts } from "./facts.js";
import { geocodeLive } from "./geocode.js";
import { parseIntake } from "./intake.js";
import { defaultRubricFor, getProjectType, PROJECT_TYPES } from "./rubrics.js";
import { scanArea } from "./scan.js";
import { score } from "./scoring.js";
import { fetchDepth } from "./sources/depth.js";
import { fetchProtectedArea } from "./sources/protectedArea.js";
import { fetchShipping } from "./sources/shipping.js";
import { fetchTemperature } from "./sources/temperature.js";
import { fetchWaves } from "./sources/waves.js";
import type { Rubric, SiteReport } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 5174;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kystkonsulent", time: new Date().toISOString() });
});

app.get("/api/config", (_req, res) => {
  res.json({ liveData: config.liveData, sourcesEnabled });
});

// Run every source for a point and report ok/value/error — handy for verifying
// credentials and endpoints during setup. Attempts all sources regardless of
// the enabled flags so misconfiguration is visible.
app.get("/api/diagnostics", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const point = {
    lat: Number.isFinite(lat) ? lat : 63.43,
    lng: Number.isFinite(lng) ? lng : 7.5,
  };
  const [protectedArea, depth, temperature, waves, shipping] = await Promise.all([
    fetchProtectedArea(point),
    fetchDepth(point),
    fetchTemperature(point),
    fetchWaves(point),
    sourcesEnabled.shipping
      ? fetchShipping(point)
      : Promise.resolve({
          ok: false,
          value: null,
          source: "BarentsWatch AIS",
          error: "not configured (set BARENTSWATCH_CLIENT_ID/SECRET + LIVE_DATA=true)",
        }),
  ]);
  res.json({
    liveData: config.liveData,
    sourcesEnabled,
    point,
    sources: { protectedArea, depth, temperature, waves, shipping },
  });
});

app.get("/api/project-types", (_req, res) => {
  res.json(PROJECT_TYPES);
});

app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q ?? "");
  res.json(await geocodeLive(q));
});

app.post("/api/describe", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  res.json(parseIntake(text));
});

function resolveRubric(projectType: string, supplied: unknown): Rubric | undefined {
  if (supplied && typeof supplied === "object") return supplied as Rubric;
  return defaultRubricFor(projectType);
}

app.post("/api/evaluate", async (req, res) => {
  const { lat, lng, projectType, rubric, placeName } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat and lng (numbers) are required" });
  }
  if (!getProjectType(projectType)) {
    return res.status(400).json({ error: `unknown projectType: ${projectType}` });
  }
  const effectiveRubric = resolveRubric(projectType, rubric);
  if (!effectiveRubric) {
    return res.status(400).json({ error: "no rubric available" });
  }

  const facts = await getFacts({ lat, lng });
  const result = score(facts, effectiveRubric);
  const report: SiteReport = {
    location: { lat, lng, placeName },
    projectType,
    facts,
    rubric: effectiveRubric,
    result,
  };
  res.json(report);
});

app.post("/api/scan", async (req, res) => {
  const { center, radiusKm, projectType, rubric, live } = req.body ?? {};
  if (
    !center ||
    typeof center.lat !== "number" ||
    typeof center.lng !== "number"
  ) {
    return res.status(400).json({ error: "center {lat,lng} is required" });
  }
  if (!getProjectType(projectType)) {
    return res.status(400).json({ error: `unknown projectType: ${projectType}` });
  }
  const effectiveRubric = resolveRubric(projectType, rubric);
  if (!effectiveRubric) {
    return res.status(400).json({ error: "no rubric available" });
  }
  const radius = Number(radiusKm) || 30;

  const result = await scanArea({
    center,
    radiusKm: radius,
    projectType,
    rubric: effectiveRubric,
    live: live === true,
  });
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Kystkonsulent API listening on http://localhost:${PORT}`);
  if (config.liveData) {
    const on = Object.entries(sourcesEnabled)
      .filter(([, v]) => v)
      .map(([k]) => k);
    console.log(`Live data ON — sources: ${on.join(", ") || "(none enabled)"}`);
    if (!sourcesEnabled.shipping) {
      console.log("  shipping (AIS) off — set BARENTSWATCH_CLIENT_ID/SECRET to enable");
    }
  } else {
    console.log("Live data OFF — serving synthetic demo data (set LIVE_DATA=true)");
  }
});
