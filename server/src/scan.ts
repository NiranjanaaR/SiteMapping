// ---------------------------------------------------------------------------
// Area-scan engine (spec §4 mode 2). Lays a grid over a radius, evaluates every
// candidate point with the fast synthetic generator, and returns a ranked
// shortlist (best first).
//
// When `live` is requested (and LIVE_DATA is on), the top candidates are then
// re-checked against the real sources — cached and concurrency-limited — and the
// shortlist is re-ranked. This is the spec §7 strategy: rank cheaply, then spend
// live calls only on the candidates that matter.
// ---------------------------------------------------------------------------

import { mapLimit } from "./cache.js";
import { config } from "./config.js";
import { getFacts, getSyntheticFacts } from "./facts.js";
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
  /** Verify the top candidates against live sources (needs LIVE_DATA). */
  live?: boolean;
}

export interface ScanResult {
  center: LatLng;
  radiusKm: number;
  candidates: SiteReport[];
  evaluated: number;
  onWater: number;
  /** How many top candidates were verified against live sources. */
  liveVerified: number;
}

export async function scanArea(req: ScanRequest): Promise<ScanResult> {
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
      const facts = getSyntheticFacts(point);
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

  // --- Live mode: verify a pool, drop land, return a clean shortlist ---------
  // The marine APIs only return data over water, so live verification doubles as
  // a land mask. We end up with the best *real* water sites for the project,
  // instead of a full grid smeared over land and sea.
  if (req.live && config.liveData) {
    const pool = candidates.slice(0, config.scanPool);
    await mapLimit(pool, config.scanConcurrency, async (cand) => {
      try {
        const liveFacts = await getFacts(cand.location, { skipShipping: true });
        cand.facts = liveFacts;
        cand.result = score(liveFacts, rubric);
      } catch {
        // keep synthetic facts/result on failure
      }
    });

    const water = pool.filter((c) => c.facts.onWater);
    const verified = water.filter((c) =>
      Object.values(c.facts.provenance).some((p) => p === "live"),
    );

    // If live verification yielded real water sites, return that shortlist.
    // Otherwise (e.g. all sources unreachable) fall back to the synthetic grid.
    if (water.length > 0) {
      water.sort((a, b) => b.result.score - a.result.score);
      const shortlist = water.slice(0, config.scanShortlist);
      return {
        center,
        radiusKm,
        candidates: shortlist,
        evaluated,
        onWater: water.length,
        liveVerified: verified.length,
      };
    }
  }

  return { center, radiusKm, candidates, evaluated, onWater, liveVerified: 0 };
}
