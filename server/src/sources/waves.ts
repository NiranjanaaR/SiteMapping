// Significant wave height (Hs) via the Open-Meteo Marine API — free, no auth,
// global coverage, point-based. (The spec's MET Ocean/THREDDS wave model is the
// "official" source but is delivered as NetCDF/OPeNDAP; Open-Meteo is a reliable
// free equivalent for the prototype.)

import { config } from "../config.js";
import type { LatLng } from "../types.js";
import { fail, type SourceOutcome } from "./types.js";

const LABEL = "Open-Meteo Marine";

export async function fetchWaves(loc: LatLng): Promise<SourceOutcome<number>> {
  try {
    const url =
      "https://marine-api.open-meteo.com/v1/marine" +
      `?latitude=${loc.lat.toFixed(4)}&longitude=${loc.lng.toFixed(4)}` +
      "&current=wave_height";
    const res = await fetch(url, { signal: AbortSignal.timeout(config.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { current?: { wave_height?: number } };
    const h = data.current?.wave_height;
    return {
      ok: true,
      value: typeof h === "number" ? Math.round(h * 10) / 10 : null,
      source: LABEL,
    };
  } catch (e) {
    return fail(LABEL, e);
  }
}
