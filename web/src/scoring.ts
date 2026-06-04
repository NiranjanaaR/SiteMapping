// Client-side mirror of the scoring engine (see server/src/scoring.ts).
// Used so that editing the rubric recalculates every visible score instantly,
// with no server round-trip. Facts never change here — only the user's criteria.

import type { Facts, Rubric, ScoreResult } from "./types";

export function band(v: number | null, lo: number, hi: number): number {
  if (v == null || Number.isNaN(v)) return 0;
  if (lo <= v && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  const span = Math.max(hi - lo, 1);
  return Math.max(0, 1 - d / (span * 0.6));
}

export function score(facts: Facts, rubric: Rubric): ScoreResult {
  const zero = { depthFit: 0, tempFit: 0, waveFit: 0 };

  if (rubric.hardExclusions.includes("protectedArea") && facts.inProtectedArea) {
    return {
      score: 0,
      verdict: "Excluded",
      breakdown: zero,
      reasons: ["Inside a legally protected / excluded area"],
      excluded: true,
    };
  }
  if (rubric.hardExclusions.includes("shippingLane") && facts.nearShippingLane) {
    return {
      score: 0,
      verdict: "Excluded",
      breakdown: zero,
      reasons: ["On or beside a designated shipping lane (hard exclusion)"],
      excluded: true,
    };
  }

  const depthFit = band(facts.depth_m, rubric.depth.min, rubric.depth.max);
  const tempFit = band(facts.temp_c, rubric.temp.min, rubric.temp.max);
  const waveFit = band(facts.wave_hs_m, 0, rubric.wave.max);

  const w = rubric.weights;
  const wsum = w.depth + w.temp + w.wave || 1;
  let raw = (depthFit * w.depth + tempFit * w.temp + waveFit * w.wave) / wsum;

  const reasons: string[] = [];
  for (const p of rubric.softPenalties) {
    if (p.when === "nearShippingLane" && facts.nearShippingLane) {
      raw *= p.factor;
      reasons.push(`${p.label} (×${p.factor})`);
    }
  }

  const pct = Math.round(raw * 100);
  const verdict: ScoreResult["verdict"] =
    pct >= 70 ? "Recommended" : pct >= 45 ? "Marginal" : "Poor fit";

  return {
    score: pct,
    verdict,
    breakdown: { depthFit, tempFit, waveFit },
    reasons,
    excluded: false,
  };
}

export function verdictTone(
  verdict: ScoreResult["verdict"],
): "good" | "marginal" | "poor" | "excluded" {
  switch (verdict) {
    case "Recommended":
      return "good";
    case "Marginal":
      return "marginal";
    case "Excluded":
      return "excluded";
    default:
      return "poor";
  }
}
