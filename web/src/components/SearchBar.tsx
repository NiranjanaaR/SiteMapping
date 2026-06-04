import { useEffect, useRef, useState } from "react";
import { geocode } from "../api";
import type { GeocodeHit } from "../types";

interface Props {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  onSelectPlace: (hit: GeocodeHit) => void;
  onScan: () => void;
  scanReady: boolean;
  scanning: boolean;
}

const RADII = [10, 30, 50];

export default function SearchBar({
  radiusKm,
  onRadiusChange,
  onSelectPlace,
  onScan,
  scanReady,
  scanning,
}: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
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
    onSelectPlace(hit);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) return;
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
          onChange={(e) => setQuery(e.target.value)}
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
        onClick={onScan}
        disabled={!scanReady || scanning}
        title={
          scanReady
            ? "Scan a grid of candidate sites in this area"
            : "Search a place or pick a map centre first"
        }
      >
        {scanning ? "Scanning…" : "Scan area"}
      </button>
    </div>
  );
}
