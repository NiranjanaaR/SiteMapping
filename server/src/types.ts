// ---------------------------------------------------------------------------
// Domain types — shared shape of the data contract (see spec §9).
// ---------------------------------------------------------------------------

export type ProjectTypeId = "seaweed" | "salmon" | "buoy";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Where a fact came from: a live API, synthetic demo data, or unavailable
 * (live mode but the source failed / has no coverage — value left null). */
export type Provenance = "live" | "synthetic" | "unavailable";

/**
 * MEASURED FACTS — read-only, derived from the data APIs.
 * The user can never edit these. A `null` value means "no coverage / unknown".
 */
export interface Facts {
  depth_m: number | null;
  temp_c: number | null;
  wave_hs_m: number | null;
  inProtectedArea: boolean;
  nearShippingLane: boolean;
  onWater: boolean;
  /** Per-field confidence so the UI can flag false precision. */
  confidence: {
    depth: "measured" | "interpolated" | "missing";
    temp: "station" | "model" | "missing";
    wave: "model" | "missing";
  };
  /** Per-field provenance: live API value vs synthetic demo value. */
  provenance: {
    depth: Provenance;
    temp: Provenance;
    wave: Provenance;
    protectedArea: Provenance;
    shipping: Provenance;
  };
}

/**
 * PROJECT CRITERIA — the user's editable requirements. Not facts.
 */
export interface Rubric {
  depth: { min: number; max: number };
  temp: { min: number; max: number };
  wave: { max: number };
  weights: { depth: number; temp: number; wave: number };
  /** ids of facts that cause an instant fail, e.g. "protectedArea". */
  hardExclusions: string[];
  softPenalties: { when: string; factor: number; label: string }[];
}

export interface ScoreResult {
  score: number;
  verdict: "Recommended" | "Marginal" | "Poor fit" | "Excluded" | "No data";
  /** Per-factor fit 0..1, or null when that factor's data is unavailable. */
  breakdown: {
    depthFit: number | null;
    tempFit: number | null;
    waveFit: number | null;
  };
  /** Human-readable notes: penalties, exclusions, and unavailable factors. */
  reasons: string[];
  excluded: boolean;
}

export interface ProjectType {
  id: ProjectTypeId;
  label: string;
  blurb: string;
  /** Locked, trustworthy baseline the user can always return to. */
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

/**
 * Result of parsing a natural-language project brief (spec §4 mode 3) into the
 * structured inputs the scan engine needs. `notes` make every inferred change
 * transparent so the user can see *why* the rubric was tweaked.
 */
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
