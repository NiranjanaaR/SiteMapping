import type { Facts } from "../types";

function confNote(level: string): string | null {
  switch (level) {
    case "interpolated":
      return "interpolated — confidence reduced";
    case "model":
      return "model estimate, not a point measurement";
    case "station":
      return "nearest station";
    case "missing":
      return "no coverage at this point";
    default:
      return null;
  }
}

function FactRow({
  name,
  value,
  unit,
  conf,
}: {
  name: string;
  value: number | null;
  unit: string;
  conf?: string;
}) {
  const note = conf ? confNote(conf) : null;
  return (
    <div className="fact">
      <span className="name">{name}</span>
      <span className="value">
        {value == null ? (
          <small>no data</small>
        ) : (
          <>
            {value}
            <small> {unit}</small>
          </>
        )}
      </span>
      {note && <span className="sub conf">{note}</span>}
    </div>
  );
}

export default function MeasuredFacts({ facts }: { facts: Facts }) {
  return (
    <section className="block measured">
      <div className="block-head">
        <span aria-hidden>🔒</span>
        <span>Measured facts</span>
        <span className="tag">demo data · read-only</span>
      </div>
      <div className="block-body">
        <div className="synthetic-note">
          ⚠ <b>Synthetic placeholder values.</b> These are generated for the
          prototype — the live Norwegian sources (Kartverket depth, MET temp &
          waves, Naturbase protected areas, BarentsWatch AIS) are not connected
          yet, so the numbers are <b>not real measurements</b>. Place search is
          live (Kartverket Stedsnavn); everything below is demo data.
        </div>
        <FactRow
          name="Seafloor depth"
          value={facts.depth_m}
          unit="m"
          conf={facts.confidence.depth}
        />
        <FactRow
          name="Water temperature"
          value={facts.temp_c}
          unit="°C"
          conf={facts.confidence.temp}
        />
        <FactRow
          name="Significant wave height (Hs)"
          value={facts.wave_hs_m}
          unit="m"
          conf={facts.confidence.wave}
        />

        <div className="fact">
          <span className="name">Protected / excluded area</span>
          <span className="value">
            {facts.inProtectedArea ? (
              <span className="pill warn">⚠ inside</span>
            ) : (
              <span className="pill ok">✓ clear</span>
            )}
          </span>
        </div>

        <div className="fact">
          <span className="name">Shipping traffic</span>
          <span className="value">
            {facts.nearShippingLane ? (
              <span className="pill flag">near a lane</span>
            ) : (
              <span className="pill ok">✓ low</span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
