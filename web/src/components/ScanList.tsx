import { scoreColor } from "../colors";
import { isLiveFacts, type ScanResult, type SiteReport } from "../types";

interface Props {
  scan: ScanResult;
  activeIndex: number | null;
  onSelect: (index: number) => void;
  liveData: boolean;
}

function shortPlace(report: SiteReport): string {
  return `${report.location.lat.toFixed(3)}, ${report.location.lng.toFixed(3)}`;
}

export default function ScanList({ scan, activeIndex, onSelect, liveData }: Props) {
  const ranked = scan.candidates;
  const viable = ranked.filter((c) => !c.result.excluded && c.result.score >= 45);

  return (
    <>
      <div className="scan-summary">
        Scanned <b>{scan.evaluated}</b> grid points within{" "}
        <b>{scan.radiusKm} km</b> · <b>{scan.onWater}</b> on water ·{" "}
        <b>{viable.length}</b> viable (score ≥ 45).
        {scan.liveVerified > 0 && (
          <>
            {" "}
            Top <b>{scan.liveVerified}</b> verified with{" "}
            <span className="prov live">live</span> data.
          </>
        )}
      </div>

      {liveData && (
        <div className="scan-hint">
          💡 Top sites are pre-verified live. Click any dot to fetch live data
          for it too.
        </div>
      )}

      {ranked.length === 0 && (
        <div className="empty-state">
          <div className="big">🌫️</div>
          <h2>No water sites found</h2>
          <p>Try a coastal place or a larger radius.</p>
        </div>
      )}

      {ranked.slice(0, 40).map((c, i) => (
        <button
          key={`${c.location.lat}-${c.location.lng}`}
          className={`scan-item ${i === activeIndex ? "active" : ""}`}
          onClick={() => onSelect(i)}
        >
          <span className="scan-rank">#{i + 1}</span>
          <span className="scan-dot" style={{ background: scoreColor(c.result) }}>
            {c.result.excluded ? "✕" : c.result.score}
          </span>
          <span className="scan-info">
            <span className="sv">
              {c.result.verdict}
              {isLiveFacts(c.facts) && <span className="prov live">live</span>}
            </span>
            <span className="sfacts">
              {c.facts.depth_m != null ? `${c.facts.depth_m} m` : "—"} ·{" "}
              {c.facts.temp_c != null ? `${c.facts.temp_c}°C` : "—"} ·{" "}
              {c.facts.wave_hs_m != null ? `${c.facts.wave_hs_m} m Hs` : "—"}
              {c.facts.inProtectedArea && " · 🛡"}
              {c.facts.nearShippingLane && " · ⚓"}
            </span>
            <span className="sc">{shortPlace(c)}</span>
          </span>
        </button>
      ))}
      {ranked.length > 40 && (
        <p className="conf">Showing the top 40 of {ranked.length} sites.</p>
      )}
    </>
  );
}
