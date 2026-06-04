import type { IntakeResult } from "../types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  result: IntakeResult | null;
}

const EXAMPLES = [
  "2-hectare mussel farm near Bergen, budget-sensitive",
  "Cold-water kelp farm near Tromsø, sheltered water, 10 km",
  "Salmon aquaculture near Bodø, exposed offshore site, avoid shipping",
  "Sensor buoy near Ålesund, deep water, wide area",
];

export default function DescribeIntake({
  value,
  onChange,
  onSubmit,
  loading,
  result,
}: Props) {
  return (
    <section className="block criteria" style={{ marginTop: 0 }}>
      <div className="block-head">
        <span aria-hidden>💬</span>
        <span>Describe your project</span>
        <span className="tag">natural language</span>
      </div>
      <div className="block-body">
        <p className="project-blurb" style={{ marginTop: 0 }}>
          Write a plain-language brief. It’s parsed into a project type, an
          editable rubric, and a region — then the area scan runs. Every inferred
          choice is shown so you can adjust it.
        </p>
        <textarea
          className="intake-text"
          rows={3}
          placeholder="e.g. 2-hectare mussel farm near Bergen, budget-sensitive…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
          }}
        />
        <div className="intake-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => onChange(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 12 }}
          onClick={onSubmit}
          disabled={loading || !value.trim()}
        >
          {loading ? "Interpreting…" : "✨ Interpret & scan"}
        </button>

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
