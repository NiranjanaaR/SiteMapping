import type { Facts, Provenance } from "../types";

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

function ProvBadge({ prov }: { prov: Provenance }) {
  return prov === "live" ? (
    <span className="prov live" title="Live value from a data API">
      live
    </span>
  ) : (
    <span className="prov demo" title="Synthetic placeholder value">
      demo
    </span>
  );
}

function FactRow({
  name,
  value,
  unit,
  conf,
  prov,
}: {
  name: string;
  value: number | null;
  unit: string;
  conf?: string;
  prov: Provenance;
}) {
  const note = conf ? confNote(conf) : null;
  return (
    <div className="fact">
      <span className="name">
        {name} <ProvBadge prov={prov} />
      </span>
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
  const p = facts.provenance;
  const allLive = Object.values(p).every((v) => v === "live");
  const anyLive = Object.values(p).some((v) => v === "live");

  return (
    <section className="block measured">
      <div className="block-head">
        <span aria-hidden>🔒</span>
        <span>Measured facts</span>
        <span className="tag">{allLive ? "live · read-only" : "read-only"}</span>
      </div>
      <div className="block-body">
        {allLive ? (
          <div className="synthetic-note live-note">
            ✅ <b>Live data.</b> Every value below came from a live source
            (Kartverket/EMODnet, MET, Naturbase, BarentsWatch).
          </div>
        ) : (
          <div className="synthetic-note">
            ⚠ <b>{anyLive ? "Partly synthetic." : "Synthetic placeholder values."}</b>{" "}
            Fields tagged <span className="prov demo">demo</span> are generated
            for the prototype, not live measurements. Enable live sources via the
            <code> .env</code> file (see README).
          </div>
        )}

        <FactRow
          name="Seafloor depth"
          value={facts.depth_m}
          unit="m"
          conf={facts.confidence.depth}
          prov={p.depth}
        />
        <FactRow
          name="Water temperature"
          value={facts.temp_c}
          unit="°C"
          conf={facts.confidence.temp}
          prov={p.temp}
        />
        <FactRow
          name="Significant wave height (Hs)"
          value={facts.wave_hs_m}
          unit="m"
          conf={facts.confidence.wave}
          prov={p.wave}
        />

        <div className="fact">
          <span className="name">
            Protected / excluded area <ProvBadge prov={p.protectedArea} />
          </span>
          <span className="value">
            {facts.inProtectedArea ? (
              <span className="pill warn">⚠ inside</span>
            ) : (
              <span className="pill ok">✓ clear</span>
            )}
          </span>
        </div>

        <div className="fact">
          <span className="name">
            Shipping traffic <ProvBadge prov={p.shipping} />
          </span>
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
