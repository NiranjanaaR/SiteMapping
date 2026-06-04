// Seafloor depth via a bathymetry WMS GetFeatureInfo (EMODnet by default).
//
// WMS 1.1.1 keeps lon/lat axis order (1.3.0 flips it for EPSG:4326, which is a
// common source of bugs). We sample a tiny 3×3 window centred on the point and
// read the elevation: EMODnet returns elevation in metres (negative below sea
// level), so depth = -elevation. A value >= 0 is treated as land.

import { config } from "../config.js";
import type { LatLng } from "../types.js";
import { fail, type SourceOutcome } from "./types.js";

const LABEL = "EMODnet Bathymetry";

/** Depth in metres (positive). null = no coverage. 0 = land / at sea level. */
export async function fetchDepth(loc: LatLng): Promise<SourceOutcome<number>> {
  try {
    const d = 0.004;
    const bbox = `${loc.lng - d},${loc.lat - d},${loc.lng + d},${loc.lat + d}`;
    const params = new URLSearchParams({
      service: "WMS",
      version: "1.1.1",
      request: "GetFeatureInfo",
      layers: config.bathymetry.layer,
      query_layers: config.bathymetry.layer,
      srs: "EPSG:4326",
      bbox,
      width: "3",
      height: "3",
      x: "1",
      y: "1",
      info_format: "application/json",
    });
    const url = `${config.bathymetry.wmsUrl}?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(config.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { features?: { properties?: Record<string, unknown> }[] };
    const props = data.features?.[0]?.properties;
    if (!props) return { ok: true, value: null, source: LABEL };

    const raw =
      pickNumber(props.elevation) ??
      pickNumber(props.depth) ??
      pickNumber(props.GRAY_INDEX) ??
      pickNumber(Object.values(props).find((v) => typeof v === "number"));
    if (raw == null) return { ok: true, value: null, source: LABEL };

    // Elevation convention: negative under the sea -> positive depth.
    const depth = raw < 0 ? Math.round(-raw) : 0;
    return { ok: true, value: depth, source: LABEL, detail: raw };
  } catch (e) {
    return fail(LABEL, e);
  }
}

function pickNumber(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}
