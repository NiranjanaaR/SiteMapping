// ---------------------------------------------------------------------------
// Kystkonsulent API service (spec §7).
//
//   POST /api/evaluate   { lat, lng, projectType, rubric? }  -> SiteReport
//   POST /api/scan       { center, radiusKm, projectType, rubric? } -> ScanResult
//   GET  /api/project-types                                  -> ProjectType[]
//   GET  /api/geocode?q=...                                  -> GeocodeHit[]
//   GET  /api/health
//
// The scoring engine and rubric handling are production-shaped; only the `facts`
// provider is mocked, so live API calls can be swapped in one source at a time
// without touching the contract or the UI.
// ---------------------------------------------------------------------------

import cors from "cors";
import express from "express";
import { getFacts } from "./facts.js";
import { geocode } from "./geocode.js";
import { defaultRubricFor, getProjectType, PROJECT_TYPES } from "./rubrics.js";
import { scanArea } from "./scan.js";
import { score } from "./scoring.js";
import type { Rubric, SiteReport } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 5174;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kystkonsulent", time: new Date().toISOString() });
});

app.get("/api/project-types", (_req, res) => {
  res.json(PROJECT_TYPES);
});

app.get("/api/geocode", (req, res) => {
  const q = String(req.query.q ?? "");
  res.json(geocode(q));
});

function resolveRubric(projectType: string, supplied: unknown): Rubric | undefined {
  if (supplied && typeof supplied === "object") return supplied as Rubric;
  return defaultRubricFor(projectType);
}

app.post("/api/evaluate", (req, res) => {
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

  const facts = getFacts({ lat, lng });
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

app.post("/api/scan", (req, res) => {
  const { center, radiusKm, projectType, rubric } = req.body ?? {};
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

  const result = scanArea({
    center,
    radiusKm: radius,
    projectType,
    rubric: effectiveRubric,
  });
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Kystkonsulent API listening on http://localhost:${PORT}`);
});
