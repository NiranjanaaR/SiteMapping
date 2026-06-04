import { useEffect } from "react";
import { createPortal } from "react-dom";
import { toneClass } from "../colors";
import type { Facts, Provenance, Rubric, ScoreResult } from "../types";

interface SiteData {
  location: { lat: number; lng: number; placeName?: string };
  facts: Facts;
  result: ScoreResult;
  rubric: Rubric;
}

interface Props {
  site: SiteData;
  projectTypeLabel: string;
  liveData: boolean;
  onClose: () => void;
}

const LIVE_SOURCE: Record<string, string> = {
  depth: "GEBCO (OpenTopoData)",
  temp: "MET oceanforecast",
  wave: "Open-Meteo Marine",
  protectedArea: "Naturbase (Miljødirektoratet)",
  shipping: "BarentsWatch AIS",
};

function sourceLabel(field: keyof typeof LIVE_SOURCE, prov: Provenance): string {
  if (prov === "live") return LIVE_SOURCE[field];
  if (prov === "synthetic") return "synthetic (demo)";
  return "unavailable";
}

function ProvTag({ prov }: { prov: Provenance }) {
  const cls = prov === "live" ? "live" : prov === "unavailable" ? "na" : "demo";
  const txt = prov === "live" ? "live" : prov === "unavailable" ? "n/a" : "demo";
  return <span className={`prov ${cls}`}>{txt}</span>;
}

function flagText(value: boolean, prov: Provenance, yes: string, no: string): string {
  if (prov === "unavailable") return "not available";
  return value ? yes : no;
}

export default function SiteReportDoc({
  site,
  projectTypeLabel,
  liveData,
  onClose,
}: Props) {
  const { location, facts, result, rubric } = site;
  const p = facts.provenance;
  const tone = toneClass(result);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wsum =
    rubric.weights.depth + rubric.weights.temp + rubric.weights.wave || 1;
  const pct = (v: number) => Math.round((v / wsum) * 100);
  const fitPct = (f: number | null) => (f == null ? "n/a" : `${Math.round(f * 100)}%`);

  const factRows = [
    {
      name: "Seafloor depth",
      value: facts.depth_m != null ? `${facts.depth_m} m` : "not available",
      conf: facts.confidence.depth,
      field: "depth" as const,
      prov: p.depth,
    },
    {
      name: "Water temperature",
      value: facts.temp_c != null ? `${facts.temp_c} °C` : "not available",
      conf: facts.confidence.temp,
      field: "temp" as const,
      prov: p.temp,
    },
    {
      name: "Significant wave height (Hs)",
      value: facts.wave_hs_m != null ? `${facts.wave_hs_m} m` : "not available",
      conf: facts.confidence.wave,
      field: "wave" as const,
      prov: p.wave,
    },
    {
      name: "Protected / excluded area",
      value: flagText(facts.inProtectedArea, p.protectedArea, "Inside a protected area", "Clear"),
      conf: "",
      field: "protectedArea" as const,
      prov: p.protectedArea,
    },
    {
      name: "Shipping traffic",
      value: flagText(facts.nearShippingLane, p.shipping, "Near a shipping lane", "Low"),
      conf: "",
      field: "shipping" as const,
      prov: p.shipping,
    },
  ];

  return createPortal(
    <div className="report-overlay" onClick={onClose}>
      <div className="report-doc" onClick={(e) => e.stopPropagation()}>
        <div className="report-actions no-print">
          <button className="btn btn-primary" onClick={() => window.print()}>
            🖨 Print / Save as PDF
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <header className="report-head">
          <div>
            <h1>Site screening report</h1>
            <div className="report-sub">
              Kystkonsulent · marine siting screening · {projectTypeLabel}
            </div>
          </div>
          <span className={`report-mode ${liveData ? "live" : "demo"}`}>
            {liveData ? "LIVE DATA" : "DEMO DATA"}
          </span>
        </header>

        <div className="report-meta">
          <div>
            <b>Location</b>
            <br />
            {location.placeName ? `${location.placeName} · ` : ""}
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
          <div>
            <b>Generated</b>
            <br />
            {new Date().toLocaleString()}
          </div>
        </div>

        <section className={`report-verdict ${tone}`}>
          <div className="rv-score">
            {result.score}
            <small>/100</small>
          </div>
          <div className="rv-text">
            <div className="rv-verdict">{result.verdict}</div>
            {result.reasons.length > 0 && (
              <ul className="rv-reasons">
                {result.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2>Measured facts</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Value</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {factRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>
                    <b>{r.value}</b>
                    {r.conf && r.prov !== "unavailable" && (
                      <div className="report-conf">{r.conf}</div>
                    )}
                  </td>
                  <td>{sourceLabel(r.field, r.prov)}</td>
                  <td>
                    <ProvTag prov={r.prov} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Criteria used ({projectTypeLabel})</h2>
          <table className="report-table">
            <tbody>
              <tr>
                <td>Acceptable depth</td>
                <td>
                  {rubric.depth.min} – {rubric.depth.max} m
                </td>
                <td>weight {pct(rubric.weights.depth)}%</td>
              </tr>
              <tr>
                <td>Acceptable temperature</td>
                <td>
                  {rubric.temp.min} – {rubric.temp.max} °C
                </td>
                <td>weight {pct(rubric.weights.temp)}%</td>
              </tr>
              <tr>
                <td>Max wave height (Hs)</td>
                <td>≤ {rubric.wave.max} m</td>
                <td>weight {pct(rubric.weights.wave)}%</td>
              </tr>
              <tr>
                <td>Hard exclusions</td>
                <td colSpan={2}>
                  {rubric.hardExclusions.length
                    ? rubric.hardExclusions.join(", ")
                    : "none"}
                </td>
              </tr>
              <tr>
                <td>Soft penalties</td>
                <td colSpan={2}>
                  {rubric.softPenalties.length
                    ? rubric.softPenalties
                        .map((s) => `${s.label} (×${s.factor})`)
                        .join(", ")
                    : "none"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Score breakdown</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Fit</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Depth</td>
                <td>{fitPct(result.breakdown.depthFit)}</td>
                <td>{pct(rubric.weights.depth)}%</td>
              </tr>
              <tr>
                <td>Temperature</td>
                <td>{fitPct(result.breakdown.tempFit)}</td>
                <td>{pct(rubric.weights.temp)}%</td>
              </tr>
              <tr>
                <td>Wave</td>
                <td>{fitPct(result.breakdown.waveFit)}</td>
                <td>{pct(rubric.weights.wave)}%</td>
              </tr>
            </tbody>
          </table>
          <p className="report-conf">
            Fit is 100% inside the acceptable range and falls off outside it.
            Unavailable factors are not scored (weights renormalised).
          </p>
        </section>

        <section className="report-disclaimer">
          <b>Indicative pre-screening only.</b> This report ranks a candidate
          site to hand to a surveyor; it is not a substitute for a physical
          survey, environmental assessment, or permit. Values are interpolated
          snapshots and missing layers do not mean all-clear. Data sources:
          GEBCO/OpenTopoData (depth), MET Norway (temperature), Open-Meteo
          (waves), Naturbase/Miljødirektoratet (protected areas), BarentsWatch
          (AIS), Kartverket (place search).
        </section>
      </div>
    </div>,
    document.body,
  );
}
