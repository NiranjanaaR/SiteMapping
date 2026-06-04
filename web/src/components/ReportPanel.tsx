import { toneClass } from "../colors";
import type { Facts, Rubric, ScoreResult } from "../types";
import CriteriaEditor from "./CriteriaEditor";
import MeasuredFacts from "./MeasuredFacts";

interface Props {
  location: { lat: number; lng: number; placeName?: string };
  facts: Facts;
  result: ScoreResult;
  rubric: Rubric;
  defaultRubric: Rubric;
  isForked: boolean;
  onRubricChange: (r: Rubric) => void;
  onReset: () => void;
  onOpenReport: () => void;
}

function Breakdown({
  result,
  rubric,
}: {
  result: ScoreResult;
  rubric: Rubric;
}) {
  const rows = [
    { label: "Depth fit", fit: result.breakdown.depthFit, w: rubric.weights.depth },
    { label: "Temp fit", fit: result.breakdown.tempFit, w: rubric.weights.temp },
    { label: "Wave fit", fit: result.breakdown.waveFit, w: rubric.weights.wave },
  ];
  return (
    <section className="block">
      <div className="block-head" style={{ background: "#f0f4f7" }}>
        <span aria-hidden>📊</span>
        <span>Score breakdown</span>
      </div>
      <div className="block-body">
        {rows.map((r) => (
          <div className="fact" key={r.label} style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="name">
                {r.label} <span className="conf">· weight {r.w}</span>
              </span>
              <span style={{ fontWeight: 800 }}>
                {r.fit == null ? "n/a" : `${Math.round(r.fit * 100)}%`}
              </span>
            </div>
            <div className="fitbar">
              <span style={{ width: `${Math.round((r.fit ?? 0) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReportPanel({
  location,
  facts,
  result,
  rubric,
  defaultRubric,
  isForked,
  onRubricChange,
  onReset,
  onOpenReport,
}: Props) {
  const tone = toneClass(result);

  if (!facts.onWater) {
    return (
      <div className="empty-state">
        <div className="big">🏔️</div>
        <h2>That point is on land</h2>
        <p>
          No marine data here. Click on water — a fjord, sound, or open coast —
          to screen a site.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`score-hero ${tone}`}>
        <div className="score-number">
          {result.score}
          <small>/100</small>
        </div>
        <div className="score-meta">
          <div className="verdict">{result.verdict}</div>
          {location.placeName && <div className="place">{location.placeName}</div>}
          <div className="coords">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
        </div>
      </div>

      <button
        className="btn btn-ghost"
        style={{ width: "100%", marginTop: 12 }}
        onClick={onOpenReport}
      >
        📄 Open full report
      </button>

      {result.reasons.length > 0 && (
        <div className="reasons">
          {result.reasons.map((r, i) => (
            <div className="r" key={i}>
              <span aria-hidden>{result.excluded ? "⛔" : "↓"}</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      <MeasuredFacts facts={facts} />
      {!result.excluded && <Breakdown result={result} rubric={rubric} />}
      <CriteriaEditor
        rubric={rubric}
        defaultRubric={defaultRubric}
        isForked={isForked}
        onChange={onRubricChange}
        onReset={onReset}
      />
    </>
  );
}
