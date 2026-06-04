// Shipping traffic via BarentsWatch AIS (OAuth2 client credentials).
//
// We fetch the latest vessel positions inside a small box (~10 km) around the
// point and treat "several vessels present" as being near a shipping lane. The
// open feed is filtered/delayed, so this is an indicator, not a census.
//
// NOTE: the exact AIS endpoint/response shape can vary by BarentsWatch API
// version; if your account uses a different path, set it via env and the code
// degrades gracefully (falls back to synthetic). Token caching avoids
// re-authenticating on every request.

import { config } from "../config.js";
import type { LatLng } from "../types.js";
import { fail, type SourceOutcome } from "./types.js";

const LABEL = "BarentsWatch AIS";
const TOKEN_URL = "https://id.barentswatch.no/connect/token";
const AIS_URL =
  process.env.BARENTSWATCH_AIS_URL ??
  "https://live.ais.barentswatch.no/v1/latest/combined";

/** Vessels in the box to count as "near a lane". */
const VESSEL_THRESHOLD = 3;

let cachedToken = { value: "", expiresAt: 0 };

async function getToken(): Promise<string> {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.barentswatch.clientId,
    client_secret: config.barentswatch.clientSecret,
    scope: "ais",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`token HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("no access_token");
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export async function fetchShipping(loc: LatLng): Promise<SourceOutcome<boolean>> {
  try {
    const token = await getToken();
    const d = 0.05; // ~5–6 km half-box
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [loc.lng - d, loc.lat - d],
          [loc.lng + d, loc.lat - d],
          [loc.lng + d, loc.lat + d],
          [loc.lng - d, loc.lat + d],
          [loc.lng - d, loc.lat - d],
        ],
      ],
    };
    const res = await fetch(AIS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ geometry, modelType: "Simple", downsample: false }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) throw new Error(`AIS HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    const count = Array.isArray(data)
      ? data.length
      : ((data as any)?.features?.length ?? 0);
    return {
      ok: true,
      value: count >= VESSEL_THRESHOLD,
      source: LABEL,
      detail: count,
    };
  } catch (e) {
    return fail(LABEL, e);
  }
}
