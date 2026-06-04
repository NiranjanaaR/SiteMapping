// Protected / excluded area check via Naturbase (Miljødirektoratet) ArcGIS REST.
// A point-intersect query with returnCountOnly answers "is this point inside a
// protected area?" without downloading geometry.

import { config } from "../config.js";
import type { LatLng } from "../types.js";
import { fail, type SourceOutcome } from "./types.js";

const LABEL = "Naturbase (Miljødirektoratet)";

export async function fetchProtectedArea(
  loc: LatLng,
): Promise<SourceOutcome<boolean>> {
  try {
    const params = new URLSearchParams({
      geometry: `${loc.lng},${loc.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      returnCountOnly: "true",
      where: "1=1",
      f: "json",
    });
    const url = `${config.protectedAreasUrl}/query?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(config.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { count?: number; error?: unknown };
    if (data.error) throw new Error(JSON.stringify(data.error));
    if (typeof data.count !== "number") throw new Error("no count in response");
    return { ok: true, value: data.count > 0, source: LABEL, detail: data.count };
  } catch (e) {
    return fail(LABEL, e);
  }
}
