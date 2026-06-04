export default function Disclaimer() {
  return (
    <div className="disclaimer">
      <span className="di" aria-hidden>
        ⚠️
      </span>
      <span>
        <b>Prototype · synthetic data.</b> Depth, temperature, waves and the
        protected/shipping flags are <b>generated demo values</b>, not live API
        data yet — treat scores as a UI demonstration. When wired to the real
        Norwegian sources this stays indicative pre-screening to hand to a
        surveyor: not a substitute for a physical survey, assessment, or permit.
      </span>
    </div>
  );
}
