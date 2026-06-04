import { useEffect, useRef, useState } from "react";
import { geocode } from "../api";
import type { GeocodeHit, InputMode } from "../types";

interface Props {
  mode: InputMode;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  onSelectPlace: (hit: GeocodeHit) => void;
  /** Scan a place (or the current map centre when `place` is null). */
  onScan: (place: GeocodeHit | null) => void;
  scanReady: boolean;
  scanning: boolean;
  /** Describe-mode: the natural-language brief and its submit. */
  describeText: string;
  onDescribeChange: (v: string) => void;
  onDescribeSubmit: () => void;
  describing: boolean;
}

const RADII = [10, 30, 50];

export default function SearchBar({
  mode,
  radiusKm,
  onRadiusChange,
  onSelectPlace,
  onScan,
  scanReady,
  scanning,
  describeText,
  onDescribeChange,
  onDescribeSubmit,
  describing,
}: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<GeocodeHit | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await geocode(query);
        if (!cancelled) {
          setHits(res);
          setActive(0);
          setOpen(true);
        }
      } catch {
        /* ignore */
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(hit: GeocodeHit) {
    setQuery(`${hit.placeName}, ${hit.county}`);
    setOpen(false);
    setChosen(hit);
    setNotice(null);
    onSelectPlace(hit);
  }

  // Resolve whatever is typed before scanning, so the scan never silently uses
  // the wrong centre. Empty box → scan the current map centre.
  async function handleScan() {
    setNotice(null);
    const q = query.trim();

    if (!q) {
      onScan(null);
      return;
    }
    if (chosen && q === `${chosen.placeName}, ${chosen.county}`) {
      onScan(chosen);
      return;
    }
    try {
      const res = await geocode(q);
      if (res.length) {
        choose(res[0]);
        onScan(res[0]);
      } else {
        setNotice(`No place found for “${q}”. Try another name or click the map.`);
      }
    } catch {
      setNotice("Place search is unavailable right now — click the map to pick a centre.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleScan();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Describe mode: the top bar becomes the natural-language project input.
  if (mode === "describe") {
    return (
      <div className="searchbar">
        <div className="search-input-wrap">
          <span className="glass" aria-hidden>
            💬
          </span>
          <input
            type="text"
            aria-label="Describe your project"
            placeholder="Describe your project — e.g. 2-hectare kelp farm near Arendal, sheltered water"
            value={describeText}
            onChange={(e) => onDescribeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onDescribeSubmit();
              }
            }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={onDescribeSubmit}
          disabled={describing || !describeText.trim()}
        >
          {describing ? "Interpreting…" : "✨ Interpret & scan"}
        </button>
      </div>
    );
  }

  return (
    <div className="searchbar">
      <div className="search-input-wrap" ref={boxRef}>
        <span className="glass" aria-hidden>
          🔍
        </span>
        <input
          type="text"
          aria-label="Search for a place on the Norwegian coast"
          placeholder="Search a place — e.g. Florø, Bergen, Bodø…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setChosen(null);
            setNotice(null);
          }}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {open && hits.length > 0 && (
          <div className="suggestions" role="listbox">
            {hits.map((h, i) => (
              <button
                key={`${h.placeName}-${h.county}`}
                className={i === active ? "active" : ""}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
              >
                <span>{h.placeName}</span>
                <span className="county">{h.county}</span>
              </button>
            ))}
          </div>
        )}
        {notice && <div className="search-notice">{notice}</div>}
      </div>

      <div className="radius-group" role="group" aria-label="Scan radius">
        {RADII.map((r) => (
          <button
            key={r}
            className={r === radiusKm ? "active" : ""}
            onClick={() => onRadiusChange(r)}
          >
            {r} km
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleScan}
        disabled={!scanReady || scanning}
        title={
          scanReady
            ? "Run the scan: rank candidate sites across this radius"
            : "Search a place or pick a map centre first"
        }
      >
        {scanning ? "Scanning…" : "▶ Run scan"}
      </button>
    </div>
  );
}
