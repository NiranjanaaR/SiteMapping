// ---------------------------------------------------------------------------
// Natural-language project intake (spec §4 mode 3).
//
// Parses a free-text brief ("2-hectare mussel farm near Bergen, budget-sensitive")
// into the structured inputs the scan engine already understands: a project type,
// a forked rubric, and a region. Every inferred change is recorded in `notes` so
// the interpretation stays transparent and editable.
//
// This is a deterministic, offline parser — the "thinnest layer" from the build
// order, made fully demoable without external dependencies. An LLM backend can
// drop in behind the same IntakeResult contract (see parseIntake's note): swap
// the body for a model call that emits the same shape, exactly as the facts
// layer is structured for swapping in live APIs.
// ---------------------------------------------------------------------------

import { findPlaceInText } from "./geocode.js";
import { defaultRubricFor } from "./rubrics.js";
import type { IntakeResult, ProjectTypeId, Rubric } from "./types.js";

const TYPE_KEYWORDS: Record<ProjectTypeId, string[]> = {
  seaweed: ["seaweed", "kelp", "macroalgae", "algae", "tang", "tare", "sugar kelp"],
  salmon: [
    "salmon",
    "laks",
    "aquaculture",
    "fish farm",
    "net pen",
    "mussel",
    "shellfish",
    "oyster",
    "scallop",
    "finfish",
  ],
  buoy: ["buoy", "sensor", "monitoring", "observation", "met station", "data station"],
};

const ALLOWED_RADII = [10, 30, 50];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function snapRadius(km: number): number {
  return ALLOWED_RADII.reduce((best, r) =>
    Math.abs(r - km) < Math.abs(best - km) ? r : best,
  );
}

/** Whole-word match so "tare" doesn't fire inside "hec-tare", etc. */
function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

function detectProjectType(text: string): { id: ProjectTypeId; matched?: string } {
  // Check the more specific types (salmon, buoy) before falling back to seaweed
  // so a mussel/fish keyword isn't shadowed.
  const order: ProjectTypeId[] = ["salmon", "buoy", "seaweed"];
  for (const id of order) {
    const hit = TYPE_KEYWORDS[id].find((k) => hasWord(text, k));
    if (hit) return { id, matched: hit };
  }
  return { id: "seaweed" };
}

function detectRadius(text: string): number {
  const explicit = text.match(/(\d{1,3})\s*km/);
  if (explicit) return snapRadius(Number(explicit[1]));
  if (/\b(small|tight|narrow|nearby|immediate)\b/.test(text)) return 10;
  if (/\b(wide|large|broad|whole region|entire)\b/.test(text)) return 50;
  return 30;
}

/**
 * parseIntake — deterministic rule-based interpretation.
 *
 * To use an LLM instead, implement an async function returning the same
 * IntakeResult shape and call it from the route; this function is the offline
 * fallback / default.
 */
export function parseIntake(raw: string): IntakeResult {
  const text = raw.toLowerCase();
  const notes: string[] = [];

  const { id: projectType, matched } = detectProjectType(text);
  const typeLabel =
    projectType === "seaweed"
      ? "seaweed / kelp"
      : projectType === "salmon"
        ? "salmon / aquaculture"
        : "sensor buoy";
  notes.push(
    matched
      ? `Project type → ${typeLabel} (matched “${matched}”).`
      : `No project keyword found → defaulted to ${typeLabel}.`,
  );

  // Fork the locked default so we can tweak it.
  const base = defaultRubricFor(projectType)!;
  const rubric: Rubric = JSON.parse(JSON.stringify(base));

  // --- exposure / wave tolerance ----------------------------------------
  if (/\b(rough|rougher|exposed|hardy|high[- ]energy|open ocean|offshore|stormy)\b/.test(text)) {
    rubric.wave.max = clamp(rubric.wave.max + 0.5, 0.5, 6);
    notes.push(`Mentions rough / exposed water → raised max wave to ${rubric.wave.max} m.`);
  } else if (/\b(sheltered|calm|protected water|low[- ]energy|fjord)\b/.test(text)) {
    rubric.wave.max = clamp(rubric.wave.max - 0.5, 0.5, 6);
    notes.push(`Mentions sheltered / calm water → lowered max wave to ${rubric.wave.max} m.`);
  }

  // --- temperature ------------------------------------------------------
  if (/\b(cold|cold[- ]water|arctic|northern|chilly)\b/.test(text)) {
    rubric.temp.min = clamp(rubric.temp.min - 2, -2, 30);
    rubric.temp.max = clamp(rubric.temp.max - 2, -2, 30);
    notes.push(`Mentions cold water → shifted temperature band to ${rubric.temp.min}–${rubric.temp.max} °C.`);
  } else if (/\b(warm|warm[- ]water|mild)\b/.test(text)) {
    rubric.temp.min = clamp(rubric.temp.min + 2, -2, 30);
    rubric.temp.max = clamp(rubric.temp.max + 2, -2, 30);
    notes.push(`Mentions warm water → shifted temperature band to ${rubric.temp.min}–${rubric.temp.max} °C.`);
  }

  // --- depth ------------------------------------------------------------
  if (/\b(deep|deeper|deep[- ]water)\b/.test(text)) {
    rubric.depth.max = clamp(Math.round(rubric.depth.max * 1.5), 1, 500);
    notes.push(`Mentions deep water → raised max depth to ${rubric.depth.max} m.`);
  } else if (/\b(shallow|shallower)\b/.test(text)) {
    rubric.depth.max = clamp(Math.round(rubric.depth.max * 0.6), rubric.depth.min + 1, 500);
    notes.push(`Mentions shallow water → lowered max depth to ${rubric.depth.max} m.`);
  }

  // --- budget sensitivity (cheaper = shallower, calmer moorings) ---------
  if (/\b(budget|budget[- ]sensitive|cost[- ]sensitive|cheap|low[- ]cost|economical)\b/.test(text)) {
    if (rubric.depth.max > 30) {
      rubric.depth.max = 30;
      notes.push("Budget-sensitive → capped max depth at 30 m (cheaper moorings).");
    }
    rubric.weights.depth = clamp(rubric.weights.depth + 10, 0, 100);
    notes.push(`Budget-sensitive → raised depth weight to ${rubric.weights.depth}.`);
  }

  // --- shipping avoidance ----------------------------------------------
  if (/\b(avoid shipping|away from (traffic|shipping)|no shipping|busy shipping|clear of traffic)\b/.test(text)) {
    if (!rubric.hardExclusions.includes("shippingLane")) {
      rubric.hardExclusions.push("shippingLane");
    }
    rubric.softPenalties = rubric.softPenalties.filter((p) => p.when !== "nearShippingLane");
    notes.push("Wants to avoid shipping → made shipping lanes a hard exclusion.");
  }

  // --- size (informational only) ---------------------------------------
  const size = text.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?(hectare|ha|km2|km²|m2)/);
  if (size) {
    notes.push(`Noted project size “${size[0]}” (does not change scoring — informs the surveyor).`);
  }

  // --- region -----------------------------------------------------------
  const place = findPlaceInText(text);
  const radiusKm = detectRadius(text);
  let region: IntakeResult["region"] = null;
  if (place) {
    region = {
      placeName: place.placeName,
      county: place.county,
      lat: place.lat,
      lng: place.lng,
      radiusKm,
    };
    notes.push(`Region → ${place.placeName} (${place.county}), ${radiusKm} km radius.`);
  } else {
    notes.push("No recognised place name found — pick a centre on the map, then scan.");
  }

  const interpretation = region
    ? `Reading this as a ${typeLabel} project near ${region.placeName} (${region.county}), scanning a ${radiusKm} km radius.`
    : `Reading this as a ${typeLabel} project. I couldn't pin a location — search a place or click the map to set the scan centre.`;

  return { projectType, rubric, region, interpretation, notes, source: "rules" };
}
