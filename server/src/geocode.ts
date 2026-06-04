// ---------------------------------------------------------------------------
// Mock geocoder for the search bar (spec §3 — Kartverket Stedsnavn in the real
// system). County is returned to disambiguate repeated place names.
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
