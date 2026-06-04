import type {
  AppConfig,
  GeocodeHit,
  IntakeResult,
  LatLng,
  ProjectType,
  Rubric,
  ScanResult,
  SiteReport,
} from "./types";

export function fetchConfig(): Promise<AppConfig> {
  return jsonFetch<AppConfig>("/api/config");
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return res.json() as Promise<T>;
}

export function fetchProjectTypes(): Promise<ProjectType[]> {
  return jsonFetch<ProjectType[]>("/api/project-types");
}

export function geocode(query: string): Promise<GeocodeHit[]> {
  return jsonFetch<GeocodeHit[]>(`/api/geocode?q=${encodeURIComponent(query)}`);
}

export function evaluate(args: {
  lat: number;
  lng: number;
  projectType: string;
  rubric?: Rubric;
  placeName?: string;
}): Promise<SiteReport> {
  return jsonFetch<SiteReport>("/api/evaluate", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function scan(args: {
  center: LatLng;
  radiusKm: number;
  projectType: string;
  rubric?: Rubric;
  live?: boolean;
}): Promise<ScanResult> {
  return jsonFetch<ScanResult>("/api/scan", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function describe(text: string): Promise<IntakeResult> {
  return jsonFetch<IntakeResult>("/api/describe", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
