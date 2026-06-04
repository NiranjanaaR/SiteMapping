import type { IntakeResult } from "../types";

interface Props {
  onPickExample: (v: string) => void;
  result: IntakeResult | null;
}

const EXAMPLES = [
  "2-hectare mussel farm near Bergen, budget-sensitive",
  "Cold-water kelp farm near Tromsø, sheltered water, 10 km",
  "Salmon aquaculture near Bodø, exposed offshore site, avoid shipping",
  "Sensor buoy near Ålesund, deep water, wide area",
];

export default function DescribeIntake({ onPickExample, result }: Props) {
  return (
    <section className="block criteria" style={{ marginTop: 0 }}>
      <div className="block-head">
        <span aria-hidden>💬</span>
        <span>Describe your project</span>
        <span className="tag">natural language</span>
      </div>
      <div className="block-body">
        <p className="project-blurb" style={{ marginTop: 0 }}>
          Type a plain-language brief in the bar at the <b>top</b> (e.g. “kelp
          farm near Arendal, sheltered water”) and press{" "}
          <b>✨ Interpret &amp; scan</b>. It’s parsed into a project type, an
          editable rubric, and a region, then the scan runs — every inferred
          choice is shown below. Or tap an example to fill it in:
        </p>
        <div className="intake-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => onPickExample(ex)}>
              {ex}
            </button>
          ))}
        </div>

        {result && (
          <div className="interpretation">
            <div className="interp-head">Here’s how I read that</div>
            <p className="interp-summary">{result.interpretation}</p>
            <ul className="interp-notes">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <p className="conf" style={{ marginTop: 6 }}>
              Parsed by the {result.source === "llm" ? "language model" : "rule-based parser"} ·
              edit the rubric below and the scores update live.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
