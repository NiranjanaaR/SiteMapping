// ---------------------------------------------------------------------------
// Area-scan engine (spec §4 mode 2). Lays a grid over a radius or bounding box,
// evaluates every candidate point, and returns a ranked shortlist (best first).
//
// In production the slow-changing layers (depth, protected areas) would be
// cached and only the top candidates would trigger live ocean-data fetches
// (spec §7). Here the facts are synthesised, so the grid is cheap.
// ---------------------------------------------------------------------------

import { getFacts } from "./facts.js";
import { score } from "./scoring.js";
import type { LatLng, Rubric, SiteReport } from "./types.js";

const KM_PER_DEG_LAT = 111.32;

function kmPerDegLng(lat: number): number {
  return KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface ScanRequest {
  center: LatLng;
  radiusKm: number;
  projectType: string;
  rubric: Rubric;
  /** Cap the grid so a big radius cannot explode the request. */
  maxPoints?: number;
}

export interface ScanResult {
  center: LatLng;
  radiusKm: number;
  candidates: SiteReport[];
  evaluated: number;
  onWater: number;
}

export function scanArea(req: ScanRequest): ScanResult {
  const { center, radiusKm, projectType, rubric } = req;
  const maxPoints = req.maxPoints ?? 400;

  // Aim for a roughly square grid that respects the point cap.
  const targetPerAxis = Math.max(5, Math.floor(Math.sqrt(maxPoints)));
  const stepKm = (radiusKm * 2) / targetPerAxis;

  const latStep = stepKm / KM_PER_DEG_LAT;
  const lngStep = stepKm / kmPerDegLng(center.lat);

  const candidates: SiteReport[] = [];
  let evaluated = 0;
  let onWater = 0;

  for (let i = -targetPerAxis / 2; i <= targetPerAxis / 2; i++) {
    for (let j = -targetPerAxis / 2; j <= targetPerAxis / 2; j++) {
      const lat = center.lat + i * latStep;
      const lng = center.lng + j * lngStep;
      const point = { lat, lng };
      if (haversineKm(center, point) > radiusKm) continue;

      evaluated++;
      const facts = getFacts(point);
      if (!facts.onWater) continue; // skip land — no marine site there
      onWater++;

      const result = score(facts, rubric);
      candidates.push({
        location: point,
        projectType: projectType as SiteReport["projectType"],
        facts,
        rubric,
        result,
      });
    }
  }

  // Rank: best score first; excluded sites sink to the bottom.
  candidates.sort((a, b) => b.result.score - a.result.score);

  return { center, radiusKm, candidates, evaluated, onWater };
}
