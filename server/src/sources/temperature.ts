// Water temperature.
//
// Primary: MET oceanforecast/2.0 — sea_water_temperature at any coastal point,
// no auth. If FROST_CLIENT_ID is set, Frost (nearest station with a sea-water
// temperature element) is tried first so the optional credential is honoured,
// falling back to oceanforecast when no station has recent data.

import { config } from "../config.js";
import type { LatLng } from "../types.js";
import { fail, type SourceOutcome } from "./types.js";

export async function fetchTemperature(loc: LatLng): Promise<SourceOutcome<number>> {
  if (config.frostClientId) {
    const frost = await frostSeaTemp(loc);
    if (frost.ok && frost.value != null) return frost;
  }
  return metOceanTemp(loc);
}

async function metOceanTemp(loc: LatLng): Promise<SourceOutcome<number>> {
  const LABEL = "MET oceanforecast";
  try {
    const url =
      "https://api.met.no/weatherapi/oceanforecast/2.0/complete" +
      `?lat=${loc.lat.toFixed(4)}&lon=${loc.lng.toFixed(4)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": config.metUserAgent },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;
    const t =
      data?.properties?.timeseries?.[0]?.data?.instant?.details
        ?.sea_water_temperature;
    return {
      ok: true,
      value: typeof t === "number" ? Math.round(t * 10) / 10 : null,
      source: LABEL,
    };
  } catch (e) {
    return fail(LABEL, e);
  }
}

async function frostSeaTemp(loc: LatLng): Promise<SourceOutcome<number>> {
  const LABEL = "MET Frost";
  try {
    const auth =
      "Basic " + Buffer.from(`${config.frostClientId}:`).toString("base64");

    const srcUrl =
      "https://frost.met.no/sources/v0.jsonld" +
      "?types=SensorSystem&elements=sea_water_temperature" +
      `&geometry=nearest(POINT(${loc.lng} ${loc.lat}))&nearestmaxcount=1`;
    const sres = await fetch(srcUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!sres.ok) throw new Error(`sources HTTP ${sres.status}`);
    const sdata = (await sres.json()) as any;
    const id = sdata?.data?.[0]?.id;
    if (!id) return { ok: true, value: null, source: LABEL };

    const now = new Date();
    const from = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    const obsUrl =
      "https://frost.met.no/observations/v0.jsonld" +
      `?sources=${id}&elements=sea_water_temperature&referencetime=${from}/${to}`;
    const ores = await fetch(obsUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!ores.ok) throw new Error(`observations HTTP ${ores.status}`);
    const odata = (await ores.json()) as any;
    const arr = odata?.data ?? [];
    const last = arr[arr.length - 1]?.observations?.[0]?.value;
    return {
      ok: true,
      value: typeof last === "number" ? Math.round(last * 10) / 10 : null,
      source: LABEL,
    };
  } catch (e) {
    return fail(LABEL, e);
  }
}
