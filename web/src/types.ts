// Client mirror of the server data contract (spec §9). Kept in sync with
// server/src/types.ts.

export type ProjectTypeId = "seaweed" | "salmon" | "buoy";

export interface LatLng {
  lat: number;
  lng: number;
}

export type Provenance = "live" | "synthetic";

export interface Facts {
  depth_m: number | null;
  temp_c: number | null;
  wave_hs_m: number | null;
  inProtectedArea: boolean;
  nearShippingLane: boolean;
  onWater: boolean;
  confidence: {
    depth: "measured" | "interpolated" | "missing";
    temp: "station" | "model" | "missing";
    wave: "model" | "missing";
  };
  provenance: {
    depth: Provenance;
    temp: Provenance;
    wave: Provenance;
    protectedArea: Provenance;
    shipping: Provenance;
  };
}

export interface Rubric {
  depth: { min: number; max: number };
  temp: { min: number; max: number };
  wave: { max: number };
  weights: { depth: number; temp: number; wave: number };
  hardExclusions: string[];
  softPenalties: { when: string; factor: number; label: string }[];
}

export interface ScoreResult {
  score: number;
  verdict: "Recommended" | "Marginal" | "Poor fit" | "Excluded";
  breakdown: { depthFit: number; tempFit: number; waveFit: number };
  reasons: string[];
  excluded: boolean;
}

export interface ProjectType {
  id: ProjectTypeId;
  label: string;
  blurb: string;
  defaultRubric: Rubric;
}

export interface SiteReport {
  location: LatLng & { placeName?: string };
  projectType: ProjectTypeId;
  facts: Facts;
  rubric: Rubric;
  result: ScoreResult;
}

export interface GeocodeHit {
  placeName: string;
  county: string;
  lat: number;
  lng: number;
}

export interface ScanResult {
  center: LatLng;
  radiusKm: number;
  candidates: SiteReport[];
  evaluated: number;
  onWater: number;
}

export interface IntakeResult {
  projectType: ProjectTypeId;
  rubric: Rubric;
  region: {
    placeName: string;
    county?: string;
    lat: number;
    lng: number;
    radiusKm: number;
  } | null;
  interpretation: string;
  notes: string[];
  source: "rules" | "llm";
}

export type InputMode = "click" | "scan" | "describe";
