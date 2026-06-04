// ---------------------------------------------------------------------------
// Scoring engine (spec §5). Pure functions: facts + rubric -> result.
//
// Unknown facts (null — e.g. a live source was unavailable) are NOT scored as a
// bad value; the factor is dropped and the remaining weights are renormalised,
// with a note. We never invent data to fill a gap.
//
// Mirrored on the client (web/src/scoring.ts) for instant live recalculation.
// ---------------------------------------------------------------------------

import type { Facts, Rubric, ScoreResult } from "./types.js";

/**
 * band(): 1.0 inside [lo, hi]; falls off linearly outside, reaching 0 at
 * ~0.6 * span beyond the edge.
 */
export function band(v: number, lo: number, hi: number): number {
  if (lo <= v && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  const span = Math.max(hi - lo, 1);
  return Math.max(0, 1 - d / (span * 0.6));
}

export function score(facts: Facts, rubric: Rubric): ScoreResult {
  const noFits = { depthFit: null, tempFit: null, waveFit: null };

  // Hard exclusions — only when we actually know the fact is true.
  if (rubric.hardExclusions.includes("protectedArea") && facts.inProtectedArea === true) {
    return {
      score: 0,
      verdict: "Excluded",
      breakdown: noFits,
      reasons: ["Inside a legally protected / excluded area"],
      excluded: true,
    };
  }
  if (rubric.hardExclusions.includes("shippingLane") && facts.nearShippingLane === true) {
    return {
      score: 0,
      verdict: "Excluded",
      breakdown: noFits,
      reasons: ["On or beside a designated shipping lane (hard exclusion)"],
      excluded: true,
    };
  }

  const depthFit =
    facts.depth_m != null ? band(facts.depth_m, rubric.depth.min, rubric.depth.max) : null;
  const tempFit =
    facts.temp_c != null ? band(facts.temp_c, rubric.temp.min, rubric.temp.max) : null;
  const waveFit =
    facts.wave_hs_m != null ? band(facts.wave_hs_m, 0, rubric.wave.max) : null;

  const reasons: string[] = [];
  if (depthFit == null) reasons.push("Depth data unavailable — not scored");
  if (tempFit == null) reasons.push("Temperature data unavailable — not scored");
  if (waveFit == null) reasons.push("Wave data unavailable — not scored");

  // Weighted average over only the factors we actually have.
  const parts: { fit: number; w: number }[] = [];
  if (depthFit != null) parts.push({ fit: depthFit, w: rubric.weights.depth });
  if (tempFit != null) parts.push({ fit: tempFit, w: rubric.weights.temp });
  if (waveFit != null) parts.push({ fit: waveFit, w: rubric.weights.wave });

  const breakdown = { depthFit, tempFit, waveFit };

  if (parts.length === 0) {
    return {
      score: 0,
      verdict: "No data",
      breakdown,
      reasons: ["No measured data available at this location"],
      excluded: false,
    };
  }

  const wsum = parts.reduce((s, p) => s + p.w, 0) || 1;
  let raw = parts.reduce((s, p) => s + p.fit * p.w, 0) / wsum;

  for (const p of rubric.softPenalties) {
    if (p.when === "nearShippingLane" && facts.nearShippingLane === true) {
      raw *= p.factor;
      reasons.push(`${p.label} (×${p.factor})`);
    }
  }

  const pct = Math.round(raw * 100);
  const verdict: ScoreResult["verdict"] =
    pct >= 70 ? "Recommended" : pct >= 45 ? "Marginal" : "Poor fit";

  return { score: pct, verdict, breakdown, reasons, excluded: false };
}
