// ---------------------------------------------------------------------------
// Mock facts provider.
//
// In the real system this module fans out to the Norwegian data APIs (Naturbase
// WFS, Kartverket bathymetry, MET Frost/Ocean, BarentsWatch AIS) and normalises
// every response into the `Facts` shape. For the thin vertical slice (spec §8)
// we synthesise deterministic, plausible values from the coordinate so the UI
// and scoring engine can be built against the real data contract (spec §9).
//
// Determinism: the same location always yields the same facts, so re-clicking a
// point or re-running a scan is stable.
// ---------------------------------------------------------------------------

import type { Facts, LatLng } from "./types.js";

/** Cheap deterministic hash of a number -> 32-bit int. */
function hashNum(n: number): number {
  let h = Math.imul(n | 0, 2654435761) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Build several independent pseudo-random streams in [0,1) from a coordinate. */
function streams(lat: number, lng: number): (i: number) => number {
  // Round to ~100 m so nearby clicks are coherent and reproducible.
  const a = Math.round(lat * 1000);
  const b = Math.round(lng * 1000);
  const seed = hashNum(a) ^ Math.imul(hashNum(b), 0x85ebca6b);
  return (i: number) => hashNum(seed + Math.imul(i + 1, 0x27d4eb2f)) / 0xffffffff;
}

function lerp(t: number, lo: number, hi: number): number {
  return lo + t * (hi - lo);
}

export function getFacts(loc: LatLng): Facts {
  const rnd = streams(loc.lat, loc.lng);

  // ~92% of clicked points sit on water; the rest read as land (no marine data).
  const onWater = rnd(0) > 0.08;

  if (!onWater) {
    return {
      depth_m: null,
      temp_c: null,
      wave_hs_m: null,
      inProtectedArea: false,
      nearShippingLane: false,
      onWater: false,
      confidence: { depth: "missing", temp: "missing", wave: "missing" },
    };
  }

  // Depth: skewed toward shallow shelf with occasional deep fjord/offshore.
  const depthRoll = rnd(1);
  const depth_m = Math.round(lerp(Math.pow(depthRoll, 2), 4, 380));

  // Water temperature: cool Norwegian coastal band.
  const temp_c = Math.round(lerp(rnd(2), 3.5, 16.5) * 10) / 10;

  // Significant wave height: more exposure offshore (loosely via longitude west).
  const exposure = Math.min(1, Math.max(0, (8 - loc.lng) / 8));
  const wave_hs_m =
    Math.round(lerp(rnd(3) * 0.7 + exposure * 0.3, 0.3, 4.6) * 10) / 10;

  const inProtectedArea = rnd(4) < 0.15;
  const nearShippingLane = rnd(5) < 0.2;

  // Depth coverage is patchy near the coast -> sometimes interpolated.
  const depthConf = rnd(6) < 0.35 ? "interpolated" : "measured";

  return {
    depth_m,
    temp_c,
    wave_hs_m,
    inProtectedArea,
    nearShippingLane,
    onWater: true,
    confidence: { depth: depthConf, temp: "model", wave: "model" },
  };
}
