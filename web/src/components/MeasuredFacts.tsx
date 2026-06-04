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
  if (prov === "live")
    return (
      <span className="prov live" title="Live value from a data API">
        live
      </span>
    );
  if (prov === "unavailable")
    return (
      <span className="prov na" title="Live source unavailable — not scored">
        n/a
      </span>
    );
  return (
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
          <small>{prov === "unavailable" ? "not available" : "no data"}</small>
        ) : (
          <>
            {value}
            <small> {unit}</small>
          </>
        )}
      </span>
      {value != null && note && <span className="sub conf">{note}</span>}
    </div>
  );
}

export default function MeasuredFacts({ facts }: { facts: Facts }) {
  const p = facts.provenance;
  const vals = Object.values(p);
  const allLive = vals.every((v) => v === "live");
  const anySynthetic = vals.some((v) => v === "synthetic");
  const anyUnavailable = vals.some((v) => v === "unavailable");

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
            (GEBCO, MET, Open-Meteo, Naturbase, BarentsWatch).
          </div>
        ) : anySynthetic ? (
          <div className="synthetic-note">
            ⚠ <b>Synthetic placeholder values.</b> Fields tagged{" "}
            <span className="prov demo">demo</span> are generated for the
            prototype, not live measurements. Enable live sources via the
            <code> .env</code> file (see README).
          </div>
        ) : anyUnavailable ? (
          <div className="synthetic-note">
            ⚠ Some live sources were <b>unavailable</b> here. Fields tagged{" "}
            <span className="prov na">n/a</span> aren’t scored — no value is
            invented. Check <code>/api/diagnostics</code> for why.
          </div>
        ) : null}

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
            {p.protectedArea === "unavailable" ? (
              <small>not available</small>
            ) : facts.inProtectedArea ? (
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
            {p.shipping === "unavailable" ? (
              <small>not available</small>
            ) : facts.nearShippingLane ? (
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
