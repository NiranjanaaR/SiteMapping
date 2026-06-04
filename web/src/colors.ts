import type { ScoreResult } from "./types";

/** Map a result to a single marker/dot colour (green / amber / red / dark). */
export function scoreColor(result: ScoreResult): string {
  if (result.excluded) return "#6b1f30";
  if (result.score >= 70) return "#16915a";
  if (result.score >= 45) return "#d98a00";
  return "#cf4733";
}

export function toneClass(
  result: ScoreResult,
): "good" | "marginal" | "poor" | "excluded" {
  if (result.excluded) return "excluded";
  if (result.score >= 70) return "good";
  if (result.score >= 45) return "marginal";
  return "poor";
}
