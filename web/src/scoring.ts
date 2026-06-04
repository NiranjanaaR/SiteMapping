// Client mirror of the scoring engine (see server/src/scoring.ts). Used so that
// editing the rubric recalculates every visible score instantly. Unknown facts
// (null) are dropped and the remaining weights renormalised — never invented.

import type { Facts, Rubric, ScoreResult } from "./types";

export function band(v: number, lo: number, hi: number): number {
  if (lo <= v && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  const span = Math.max(hi - lo, 1);
  return Math.max(0, 1 - d / (span * 0.6));
}

export function score(facts: Facts, rubric: Rubric): ScoreResult {
  const noFits = { depthFit: null, tempFit: null, waveFit: null };

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
