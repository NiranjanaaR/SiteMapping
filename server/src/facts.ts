// ---------------------------------------------------------------------------
// Facts provider.
//
// getFacts() fans out to the live Norwegian data sources in parallel (when
// LIVE_DATA is on) and overlays whatever succeeds onto a synthetic baseline,
// tracking per-field provenance (live vs synthetic). getSyntheticFacts() is the
// deterministic demo generator used as the baseline and for area scans (calling
// live APIs for hundreds of grid points would hit rate limits).
//
// Determinism (synthetic): the same location always yields the same values, so
// re-clicking a point or re-running a scan is stable.
// ---------------------------------------------------------------------------

import { cached } from "./cache.js";
import { config, sourcesEnabled } from "./config.js";
import { fetchDepth } from "./sources/depth.js";
import { fetchProtectedArea } from "./sources/protectedArea.js";
import { fetchShipping } from "./sources/shipping.js";
import { fetchTemperature } from "./sources/temperature.js";
import { fetchWaves } from "./sources/waves.js";
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

const ALL_SYNTHETIC: Facts["provenance"] = {
  depth: "synthetic",
  temp: "synthetic",
  wave: "synthetic",
  protectedArea: "synthetic",
  shipping: "synthetic",
};

export function getSyntheticFacts(loc: LatLng): Facts {
  const rnd = streams(loc.lat, loc.lng);

  // We can't reliably tell land from sea without a coastline mask, so we never
  // guess "on land" — the user is screening the coast. Real bathymetry (when
  // live) provides the actual depth; here we synthesise a plausible one.

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
    provenance: { ...ALL_SYNTHETIC },
  };
}

export interface FactsOptions {
  /** Skip the slower AIS call (used during scans to protect rate limits). */
  skipShipping?: boolean;
}

/**
 * Live facts (cached by ~100 m): synthetic baseline overlaid with whatever the
 * live sources return. When LIVE_DATA is off this is just the synthetic facts.
 */
export async function getFacts(
  loc: LatLng,
  opts: FactsOptions = {},
): Promise<Facts> {
  if (!config.liveData) return getSyntheticFacts(loc);
  const key = `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}${opts.skipShipping ? ":ns" : ""}`;
  return cached(key, config.factsCacheTtlMs, () => computeLiveFacts(loc, opts));
}

async function computeLiveFacts(
  loc: LatLng,
  opts: FactsOptions,
): Promise<Facts> {
  const facts = getSyntheticFacts(loc);

  const [paR, dpR, tpR, wvR, shR] = await Promise.allSettled([
    sourcesEnabled.protectedArea ? fetchProtectedArea(loc) : Promise.resolve(null),
    sourcesEnabled.depth ? fetchDepth(loc) : Promise.resolve(null),
    sourcesEnabled.temperature ? fetchTemperature(loc) : Promise.resolve(null),
    sourcesEnabled.waves ? fetchWaves(loc) : Promise.resolve(null),
    sourcesEnabled.shipping && !opts.skipShipping
      ? fetchShipping(loc)
      : Promise.resolve(null),
  ]);
  const settled = <T>(r: PromiseSettledResult<T | null>): T | null =>
    r.status === "fulfilled" ? r.value : null;

  // Land/sea mask from the marine sources: they return values over water and
  // nothing over land. `respondedLand` means a source answered but had no
  // marine data there (land); `respondedWater` means real marine data came back.
  let respondedWater = false;
  let respondedLand = false;

  const dp = settled(dpR);
  if (dp?.ok) {
    if (dp.value != null && dp.value > 0) {
      facts.depth_m = dp.value;
      facts.confidence.depth = "measured";
      facts.provenance.depth = "live";
      respondedWater = true;
    } else {
      respondedLand = true; // elevation >= 0 -> land / at sea level
    }
  }

  const tp = settled(tpR);
  if (tp?.ok) {
    if (tp.value != null) {
      facts.temp_c = tp.value;
      facts.confidence.temp = "model";
      facts.provenance.temp = "live";
      respondedWater = true;
    } else {
      respondedLand = true;
    }
  }

  const wv = settled(wvR);
  if (wv?.ok) {
    if (wv.value != null) {
      facts.wave_hs_m = wv.value;
      facts.confidence.wave = "model";
      facts.provenance.wave = "live";
      respondedWater = true;
    } else {
      respondedLand = true;
    }
  }

  const pa = settled(paR);
  if (pa?.ok && pa.value != null) {
    facts.inProtectedArea = pa.value;
    facts.provenance.protectedArea = "live";
  }

  const sh = settled(shR);
  if (sh?.ok && sh.value != null) {
    facts.nearShippingLane = sh.value;
    facts.provenance.shipping = "live";
  }

  // Decide water vs land only when the marine sources actually responded; if
  // they all errored (network), leave the optimistic synthetic default.
  if (respondedWater) facts.onWater = true;
  else if (respondedLand) facts.onWater = false;

  return facts;
}
