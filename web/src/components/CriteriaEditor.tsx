import type { Rubric } from "../types";

interface Props {
  rubric: Rubric;
  defaultRubric: Rubric;
  isForked: boolean;
  onChange: (r: Rubric) => void;
  onReset: () => void;
}

const FACTORS = [
  { key: "depth", label: "Depth", unit: "m", min: 0, max: 500, step: 1 },
  { key: "temp", label: "Temperature", unit: "°C", min: -2, max: 30, step: 0.5 },
] as const;

export default function CriteriaEditor({
  rubric,
  defaultRubric,
  isForked,
  onChange,
  onReset,
}: Props) {
  function patch(p: Partial<Rubric>) {
    onChange({ ...rubric, ...p });
  }

  function setRange(
    key: "depth" | "temp",
    bound: "min" | "max",
    value: number,
  ) {
    patch({ [key]: { ...rubric[key], [bound]: value } } as Partial<Rubric>);
  }

  function setWeight(key: "depth" | "temp" | "wave", value: number) {
    patch({ weights: { ...rubric.weights, [key]: value } });
  }

  const wsum =
    rubric.weights.depth + rubric.weights.temp + rubric.weights.wave || 1;
  const pct = (v: number) => Math.round((v / wsum) * 100);

  const shippingHard = rubric.hardExclusions.includes("shippingLane");

  function toggleShippingHard(hard: boolean) {
    const hardExclusions = hard
      ? Array.from(new Set([...rubric.hardExclusions, "shippingLane"]))
      : rubric.hardExclusions.filter((x) => x !== "shippingLane");
    const softPenalties = hard
      ? rubric.softPenalties.filter((p) => p.when !== "nearShippingLane")
      : rubric.softPenalties.some((p) => p.when === "nearShippingLane")
        ? rubric.softPenalties
        : [
            ...rubric.softPenalties,
            { when: "nearShippingLane", factor: 0.7, label: "Near a shipping lane" },
          ];
    patch({ hardExclusions, softPenalties });
  }

  return (
    <section className="block criteria">
      <div className="block-head">
        <span aria-hidden>✏️</span>
        <span>Your criteria</span>
        <span className="tag">editable</span>
      </div>
      <div className="block-body">
        {isForked ? (
          <p className="project-blurb" style={{ marginTop: 0 }}>
            You’ve edited this rubric. The locked default is one click away.
          </p>
        ) : (
          <p className="project-blurb" style={{ marginTop: 0 }}>
            Trusted default rubric. Edit any value to recalculate scores live.
          </p>
        )}

        {/* Ranges */}
        {FACTORS.map((f) => (
          <div className="criteria-row" key={f.key}>
            <div className="crlabel">
              <span>
                Acceptable {f.label.toLowerCase()} ({f.unit})
              </span>
              <span className="crval">
                {rubric[f.key].min} – {rubric[f.key].max}
              </span>
            </div>
            <div className="range">
              <input
                type="number"
                aria-label={`${f.label} minimum`}
                value={rubric[f.key].min}
                min={f.min}
                max={rubric[f.key].max}
                step={f.step}
                onChange={(e) => setRange(f.key, "min", Number(e.target.value))}
              />
              <span className="dash">to</span>
              <input
                type="number"
                aria-label={`${f.label} maximum`}
                value={rubric[f.key].max}
                min={rubric[f.key].min}
                max={f.max}
                step={f.step}
                onChange={(e) => setRange(f.key, "max", Number(e.target.value))}
              />
            </div>
          </div>
        ))}

        {/* Max wave */}
        <div className="criteria-row">
          <div className="crlabel">
            <span>Max wave height Hs (m)</span>
            <span className="crval">{rubric.wave.max.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.1}
            value={rubric.wave.max}
            onChange={(e) =>
              patch({ wave: { max: Number(e.target.value) } })
            }
            aria-label="Maximum wave height"
          />
        </div>

        {/* Weights */}
        <div className="criteria-row weights">
          <div className="crlabel">
            <span>Factor weights</span>
            <span className="crval">normalised to 100%</span>
          </div>
          {(["depth", "temp", "wave"] as const).map((k) => (
            <div className="wrow" key={k}>
              <span className="wname">
                {k === "temp" ? "Temp" : k[0].toUpperCase() + k.slice(1)}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={rubric.weights[k]}
                onChange={(e) => setWeight(k, Number(e.target.value))}
                aria-label={`${k} weight`}
              />
              <span className="wpct">{pct(rubric.weights[k])}%</span>
            </div>
          ))}
        </div>

        {/* Exclusions */}
        <div className="criteria-row">
          <div className="crlabel">
            <span>Hard exclusions</span>
          </div>
          <label className="excl">
            <input type="checkbox" checked disabled />
            <span>
              Inside a protected area → <b>instant fail</b> (always on)
            </span>
          </label>
          <label className="excl">
            <input
              type="checkbox"
              checked={shippingHard}
              onChange={(e) => toggleShippingHard(e.target.checked)}
            />
            <span>
              Shipping lane:{" "}
              {shippingHard ? (
                <b>hard exclude</b>
              ) : (
                <>
                  soft <b>−30%</b> penalty
                </>
              )}
            </span>
          </label>
        </div>

        <div className="criteria-actions">
          <button
            className="btn btn-ghost"
            onClick={onReset}
            disabled={!isForked}
            title={
              isForked
                ? "Return to the locked default rubric"
                : "Already on the default rubric"
            }
          >
            ↺ Reset to default
          </button>
        </div>
        <p className="conf" style={{ marginTop: 8 }}>
          Default for reference — Depth {defaultRubric.depth.min}–
          {defaultRubric.depth.max} m · Temp {defaultRubric.temp.min}–
          {defaultRubric.temp.max} °C · Wave ≤ {defaultRubric.wave.max} m
        </p>
      </div>
    </section>
  );
}
