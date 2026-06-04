// ---------------------------------------------------------------------------
// Domain types — shared shape of the data contract (see spec §9).
// ---------------------------------------------------------------------------

export type ProjectTypeId = "seaweed" | "salmon" | "buoy";

export interface LatLng {
  lat: number;
  lng: number;
}

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
  /** Per-field provenance so the UI can flag false precision. */
  confidence: {
    depth: "measured" | "interpolated" | "missing";
    temp: "station" | "model" | "missing";
    wave: "model" | "missing";
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
  verdict: "Recommended" | "Marginal" | "Poor fit" | "Excluded";
  breakdown: { depthFit: number; tempFit: number; waveFit: number };
  /** Human-readable notes: which penalties / exclusions fired. */
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
