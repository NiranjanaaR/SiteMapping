// Seafloor depth via OpenTopoData (GEBCO global bathymetry). Returns elevation
// in metres (negative below sea level), so depth = -elevation. A value >= 0 is
// land / at sea level -> null (no marine depth). Supports batched queries so a
// whole scan pool can be fetched in one request.

import { config } from "../config.js";
import type { LatLng } from "../types.js";
import { fail, type SourceOutcome } from "./types.js";

const LABEL = "GEBCO (OpenTopoData)";

function elevationToDepth(elev: unknown): number | null {
  if (typeof elev !== "number" || Number.isNaN(elev)) return null;
  return elev < 0 ? Math.round(-elev) : null; // negative elevation -> sea depth
}

export async function fetchDepth(loc: LatLng): Promise<SourceOutcome<number>> {
  try {
    const url =
      `${config.bathymetry.url}/${config.bathymetry.dataset}` +
      `?locations=${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(config.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { results?: { elevation?: number }[] };
    const elev = data.results?.[0]?.elevation;
    return { ok: true, value: elevationToDepth(elev), source: LABEL, detail: elev ?? undefined };
  } catch (e) {
    return fail(LABEL, e);
  }
}

/**
 * Batched depths for many points in a single request (OpenTopoData allows up to
 * 100 locations). Returns depths aligned to `locs`; throws on failure so the
 * caller can fall back.
 */
export async function fetchDepthBatch(locs: LatLng[]): Promise<(number | null)[]> {
  if (locs.length === 0) return [];
  const points = locs
    .map((l) => `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`)
    .join("|");
  const url = `${config.bathymetry.url}/${config.bathymetry.dataset}?locations=${points}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.timeoutMs * 2),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { results?: { elevation?: number }[] };
  const results = data.results ?? [];
  return locs.map((_, i) => elevationToDepth(results[i]?.elevation));
}
