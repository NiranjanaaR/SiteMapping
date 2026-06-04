export default function Disclaimer() {
  return (
    <div className="disclaimer">
      <span className="di" aria-hidden>
        ⚠️
      </span>
      <span>
        <b>Indicative pre-screening only.</b> Check each fact's{" "}
        <span className="prov live">live</span> /{" "}
        <span className="prov demo">demo</span> tag — demo values are synthetic.
        Even with live data this ranks candidate sites to hand to a surveyor; it
        is not a substitute for a physical survey, assessment, or permit. Values
        are interpolated snapshots and missing layers do <b>not</b> mean
        all-clear.
      </span>
    </div>
  );
}
