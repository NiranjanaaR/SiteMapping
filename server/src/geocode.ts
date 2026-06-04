// ---------------------------------------------------------------------------
// Geocoder for the search bar (spec §3 — Kartverket Stedsnavn).
//
// geocodeLive() calls Kartverket's free, open Stedsnavn place-search API so any
// Norwegian place resolves. If that call fails (offline / blocked network), it
// falls back to the small built-in PLACES list below. County is returned to
// disambiguate repeated names.
// ---------------------------------------------------------------------------

import type { GeocodeHit } from "./types.js";

export const PLACES: GeocodeHit[] = [
  { placeName: "Florø", county: "Vestland", lat: 61.6, lng: 5.03 },
  { placeName: "Bergen", county: "Vestland", lat: 60.39, lng: 5.32 },
  { placeName: "Ålesund", county: "Møre og Romsdal", lat: 62.47, lng: 6.15 },
  { placeName: "Bodø", county: "Nordland", lat: 67.28, lng: 14.4 },
  { placeName: "Tromsø", county: "Troms", lat: 69.65, lng: 18.96 },
  { placeName: "Kristiansund", county: "Møre og Romsdal", lat: 63.11, lng: 7.73 },
  { placeName: "Trondheim", county: "Trøndelag", lat: 63.43, lng: 10.39 },
  { placeName: "Stavanger", county: "Rogaland", lat: 58.97, lng: 5.73 },
  { placeName: "Haugesund", county: "Rogaland", lat: 59.41, lng: 5.27 },
  { placeName: "Måløy", county: "Vestland", lat: 61.94, lng: 5.11 },
  { placeName: "Namsos", county: "Trøndelag", lat: 64.47, lng: 11.5 },
  { placeName: "Harstad", county: "Troms", lat: 68.8, lng: 16.54 },
  { placeName: "Svolvær", county: "Nordland", lat: 68.23, lng: 14.57 },
  { placeName: "Hammerfest", county: "Finnmark", lat: 70.66, lng: 23.68 },
  { placeName: "Kristiansand", county: "Agder", lat: 58.15, lng: 8.0 },
  { placeName: "Egersund", county: "Rogaland", lat: 58.45, lng: 5.99 },
  { placeName: "Mandal", county: "Agder", lat: 58.03, lng: 7.45 },
  { placeName: "Brønnøysund", county: "Nordland", lat: 65.47, lng: 12.21 },
  { placeName: "Arendal", county: "Agder", lat: 58.46, lng: 8.77 },
  { placeName: "Grimstad", county: "Agder", lat: 58.34, lng: 8.59 },
  { placeName: "Lillesand", county: "Agder", lat: 58.25, lng: 8.38 },
  { placeName: "Kragerø", county: "Telemark", lat: 58.87, lng: 9.41 },
  { placeName: "Larvik", county: "Vestfold", lat: 59.05, lng: 10.03 },
  { placeName: "Sandefjord", county: "Vestfold", lat: 59.13, lng: 10.22 },
  { placeName: "Tønsberg", county: "Vestfold", lat: 59.27, lng: 10.41 },
  { placeName: "Flekkefjord", county: "Agder", lat: 58.3, lng: 6.66 },
  { placeName: "Farsund", county: "Agder", lat: 58.09, lng: 6.8 },
];

/** Find the first known place mentioned anywhere in a free-text string. */
export function findPlaceInText(text: string): GeocodeHit | undefined {
  const lower = text.toLowerCase();
  // Prefer the longest matching name so "Kristiansund" wins over "Kristiansand"
  // only when actually present; longest-first avoids partial mis-hits.
  const byLength = [...PLACES].sort(
    (a, b) => b.placeName.length - a.placeName.length,
  );
  return byLength.find((p) => lower.includes(p.placeName.toLowerCase()));
}

/** Offline fallback: search the built-in PLACES list. */
export function geocode(query: string, limit = 8): GeocodeHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = PLACES.filter((p) => p.placeName.toLowerCase().startsWith(q));
  const contains = PLACES.filter(
    (p) =>
      !p.placeName.toLowerCase().startsWith(q) &&
      p.placeName.toLowerCase().includes(q),
  );
  return [...starts, ...contains].slice(0, limit);
}

// Prefer populated places over minor features when ranking Stedsnavn results.
const PLACE_TYPE_RANK: Record<string, number> = {
  By: 0,
  Tettsted: 1,
  Tettbebyggelse: 1,
  Grend: 2,
  Bygd: 2,
  Øy: 3,
  Fjord: 3,
};

/**
 * Live geocoding via Kartverket Stedsnavn (open, no auth). Falls back to the
 * built-in PLACES list on any error so search still works offline.
 */
export async function geocodeLive(query: string, limit = 8): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const url =
      "https://api.kartverket.no/stedsnavn/v1/navn" +
      `?sok=${encodeURIComponent(q)}*` +
      "&utkoordsys=4258&treffPerSide=20&side=1";
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`stedsnavn ${res.status}`);

    const data = (await res.json()) as { navn?: any[] };
    const navn = data.navn ?? [];

    const hits: (GeocodeHit & { rank: number })[] = navn
      .map((n) => {
        const pt = n.representasjonspunkt;
        if (!pt || typeof pt.nord !== "number" || typeof pt["øst"] !== "number") {
          return null;
        }
        const county =
          n.fylker?.[0]?.fylkesnavn ?? n.kommuner?.[0]?.kommunenavn ?? "Norge";
        return {
          placeName: n["skrivemåte"] as string,
          county,
          lat: pt.nord as number,
          lng: pt["øst"] as number,
          rank: PLACE_TYPE_RANK[n.navneobjekttype] ?? 5,
        };
      })
      .filter((h): h is GeocodeHit & { rank: number } => h !== null);

    // De-duplicate by name + county, then rank populated places first.
    const seen = new Set<string>();
    const unique = hits.filter((h) => {
      const key = `${h.placeName}|${h.county}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => a.rank - b.rank);

    const result = unique
      .slice(0, limit)
      .map(({ placeName, county, lat, lng }) => ({ placeName, county, lat, lng }));

    return result.length ? result : geocode(q, limit);
  } catch {
    return geocode(q, limit);
  }
}
