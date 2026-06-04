import { useEffect, useMemo, useState } from "react";
import {
  describe as describeApi,
  evaluate,
  fetchConfig,
  fetchProjectTypes,
  scan as scanApi,
} from "./api";
import { scoreColor } from "./colors";
import CriteriaEditor from "./components/CriteriaEditor";
import DescribeIntake from "./components/DescribeIntake";
import Disclaimer from "./components/Disclaimer";
import Header from "./components/Header";
import MapView, { type ViewTarget } from "./components/MapView";
import ReportPanel from "./components/ReportPanel";
import ScanList from "./components/ScanList";
import SearchBar from "./components/SearchBar";
import Sidebar, { type LayerState } from "./components/Sidebar";
import { score } from "./scoring";
import { isLiveFacts } from "./types";
import type {
  Facts,
  GeocodeHit,
  InputMode,
  IntakeResult,
  LatLng,
  ProjectType,
  ProjectTypeId,
  Rubric,
} from "./types";

const USER_EMAIL = "anita@visible.no";
const NORWAY_CENTER: LatLng = { lat: 63.8, lng: 9.5 };

interface ClickPick {
  location: LatLng & { placeName?: string };
  facts: Facts;
}
interface ScanRaw {
  center: LatLng;
  radiusKm: number;
  evaluated: number;
  onWater: number;
  liveVerified: number;
  points: { location: LatLng; facts: Facts }[];
}

const keyOf = (l: LatLng) => `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
const zoomForRadius = (km: number) => (km <= 10 ? 11 : km <= 30 ? 9 : 8);

export default function App() {
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [projectTypeId, setProjectTypeId] = useState<ProjectTypeId>("seaweed");
  const [rubric, setRubric] = useState<Rubric | null>(null);

  const [mode, setMode] = useState<InputMode>("click");
  const [radiusKm, setRadiusKm] = useState(30);
  const [layers, setLayers] = useState<LayerState>({
    protected: true,
    shipping: true,
    depth: false,
  });

  const [mapCenter, setMapCenter] = useState<LatLng>(NORWAY_CENTER);
  const [pendingPlace, setPendingPlace] = useState<GeocodeHit | null>(null);
  const [viewTarget, setViewTarget] = useState<ViewTarget | null>(null);

  const [pick, setPick] = useState<ClickPick | null>(null);
  const [scanRaw, setScanRaw] = useState<ScanRaw | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [describeText, setDescribeText] = useState("");
  const [intake, setIntake] = useState<IntakeResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveData, setLiveData] = useState(false);

  // Load project types + seed the default rubric.
  useEffect(() => {
    fetchProjectTypes()
      .then((types) => {
        setProjectTypes(types);
        const seaweed = types.find((t) => t.id === "seaweed") ?? types[0];
        if (seaweed) {
          setProjectTypeId(seaweed.id);
          setRubric(seaweed.defaultRubric);
        }
      })
      .catch((e) => setError(`Could not load project types: ${e.message}`));
    fetchConfig()
      .then((c) => setLiveData(c.liveData))
      .catch(() => setLiveData(false));
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4500);
    return () => clearTimeout(t);
  }, [error]);

  const defaultRubric = useMemo(
    () => projectTypes.find((p) => p.id === projectTypeId)?.defaultRubric ?? null,
    [projectTypes, projectTypeId],
  );

  const isForked = useMemo(
    () =>
      !!rubric &&
      !!defaultRubric &&
      JSON.stringify(rubric) !== JSON.stringify(defaultRubric),
    [rubric, defaultRubric],
  );

  // Live recompute of the clicked-point result against the current rubric.
  const pickResult = useMemo(
    () => (pick && rubric ? score(pick.facts, rubric) : null),
    [pick, rubric],
  );

  // Live re-rank of scan candidates against the current rubric.
  const scan = useMemo(() => {
    if (!scanRaw || !rubric) return null;
    const candidates = scanRaw.points
      .map((p) => ({
        location: p.location,
        projectType: projectTypeId,
        facts: p.facts,
        rubric,
        result: score(p.facts, rubric),
      }))
      .sort((a, b) => b.result.score - a.result.score);
    return {
      center: scanRaw.center,
      radiusKm: scanRaw.radiusKm,
      candidates,
      evaluated: scanRaw.evaluated,
      onWater: scanRaw.onWater,
      liveVerified: scanRaw.liveVerified,
    };
  }, [scanRaw, rubric, projectTypeId]);

  const activeIndex = useMemo(() => {
    if (!scan || !activeKey) return null;
    const i = scan.candidates.findIndex((c) => keyOf(c.location) === activeKey);
    return i >= 0 ? i : null;
  }, [scan, activeKey]);

  // --- handlers ----------------------------------------------------------

  function onProjectChange(id: ProjectTypeId) {
    setProjectTypeId(id);
    const def = projectTypes.find((p) => p.id === id)?.defaultRubric;
    if (def) setRubric(def);
  }

  function onSelectPlace(hit: GeocodeHit) {
    setPendingPlace(hit);
    setMapCenter({ lat: hit.lat, lng: hit.lng });
    setViewTarget({ lat: hit.lat, lng: hit.lng, zoom: 10, id: Date.now() });
  }

  async function onPick(lat: number, lng: number) {
    if (!rubric) return;
    setLoading(true);
    try {
      const report = await evaluate({ lat, lng, projectType: projectTypeId, rubric });
      setPick({ location: report.location, facts: report.facts });
    } catch (e) {
      setError(`Evaluation failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runScan(place: GeocodeHit | null) {
    if (!rubric) return;
    if (place) setPendingPlace(place);
    const center = place
      ? { lat: place.lat, lng: place.lng }
      : pendingPlace
        ? { lat: pendingPlace.lat, lng: pendingPlace.lng }
        : mapCenter;
    setLoading(true);
    setMode("scan");
    try {
      const res = await scanApi({
        center,
        radiusKm,
        projectType: projectTypeId,
        rubric,
        live: liveData,
      });
      setScanRaw({
        center: res.center,
        radiusKm: res.radiusKm,
        evaluated: res.evaluated,
        onWater: res.onWater,
        liveVerified: res.liveVerified,
        points: res.candidates.map((c) => ({
          location: c.location,
          facts: c.facts,
        })),
      });
      setActiveKey(null);
      setViewTarget({
        lat: center.lat,
        lng: center.lng,
        zoom: zoomForRadius(radiusKm),
        id: Date.now(),
      });
    } catch (e) {
      setError(`Scan failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runDescribe() {
    if (!describeText.trim()) return;
    setLoading(true);
    setMode("describe");
    try {
      const res = await describeApi(describeText);
      setIntake(res);
      setProjectTypeId(res.projectType);
      setRubric(res.rubric);

      if (res.region) {
        const center = { lat: res.region.lat, lng: res.region.lng };
        setRadiusKm(res.region.radiusKm);
        setPendingPlace({
          placeName: res.region.placeName,
          county: res.region.county ?? "",
          lat: center.lat,
          lng: center.lng,
        });
        const scanRes = await scanApi({
          center,
          radiusKm: res.region.radiusKm,
          projectType: res.projectType,
          rubric: res.rubric,
          live: liveData,
        });
        setScanRaw({
          center: scanRes.center,
          radiusKm: scanRes.radiusKm,
          evaluated: scanRes.evaluated,
          onWater: scanRes.onWater,
          liveVerified: scanRes.liveVerified,
          points: scanRes.candidates.map((c) => ({
            location: c.location,
            facts: c.facts,
          })),
        });
        setActiveKey(null);
        setViewTarget({
          lat: center.lat,
          lng: center.lng,
          zoom: zoomForRadius(res.region.radiusKm),
          id: Date.now(),
        });
      } else {
        setScanRaw(null);
      }
    } catch (e) {
      setError(`Could not interpret the brief: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function selectCandidate(i: number) {
    if (!scan || !rubric) return;
    const c = scan.candidates[i];
    if (!c) return;
    setActiveKey(keyOf(c.location));
    setViewTarget({
      lat: c.location.lat,
      lng: c.location.lng,
      zoom: 11,
      id: Date.now(),
    });

    // If live mode is on and this candidate wasn't in the pre-verified top set,
    // verify it live on demand so every inspected site can show real data.
    if (liveData && !isLiveFacts(c.facts)) {
      const k = keyOf(c.location);
      setLoading(true);
      try {
        const report = await evaluate({
          lat: c.location.lat,
          lng: c.location.lng,
          projectType: projectTypeId,
          rubric,
        });
        setScanRaw((prev) =>
          prev
            ? {
                ...prev,
                points: prev.points.map((p) =>
                  keyOf(p.location) === k
                    ? { location: p.location, facts: report.facts }
                    : p,
                ),
              }
            : prev,
        );
      } catch (e) {
        setError(`Live check failed: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    }
  }

  // --- right panel content ----------------------------------------------

  function renderRightPanel() {
    if (!rubric || !defaultRubric) return null;

    const editorProps = {
      rubric,
      defaultRubric,
      isForked,
      onRubricChange: setRubric,
      onReset: () => defaultRubric && setRubric(defaultRubric),
    };

    const criteriaEditor = (
      <CriteriaEditor
        rubric={rubric}
        defaultRubric={defaultRubric}
        isForked={isForked}
        onChange={setRubric}
        onReset={editorProps.onReset}
      />
    );

    const describeCard =
      mode === "describe" ? (
        <DescribeIntake
          value={describeText}
          onChange={setDescribeText}
          onSubmit={runDescribe}
          loading={loading}
          result={intake}
        />
      ) : null;

    // Scan / describe mode, a candidate selected → its full report.
    if ((mode === "scan" || mode === "describe") && scan && activeIndex != null) {
      const c = scan.candidates[activeIndex];
      return (
        <>
          <button
            className="btn btn-ghost"
            style={{ marginBottom: 14 }}
            onClick={() => setActiveKey(null)}
          >
            ← Back to ranked list
          </button>
          <ReportPanel
            location={c.location}
            facts={c.facts}
            result={c.result}
            {...editorProps}
          />
        </>
      );
    }

    // Scan / describe mode, list view.
    if (mode === "scan" || mode === "describe") {
      return (
        <>
          {describeCard}
          {scan ? (
            <div style={{ marginTop: mode === "describe" ? 18 : 0 }}>
              <ScanList
              scan={scan}
              activeIndex={activeIndex}
              onSelect={selectCandidate}
              liveData={liveData}
            />
            </div>
          ) : mode === "scan" ? (
            <div className="empty-state">
              <div className="big">🗺️</div>
              <h2>Scan an area</h2>
              <p>
                Search a place (or pan the map), pick a radius above, then press
                <b> Scan area</b>. Candidate sites appear as coloured dots,
                ranked best-first here.
              </p>
            </div>
          ) : null}
          {criteriaEditor}
        </>
      );
    }

    // Click mode.
    if (pick && pickResult) {
      return (
        <ReportPanel
          location={pick.location}
          facts={pick.facts}
          result={pickResult}
          {...editorProps}
        />
      );
    }
    return (
      <>
        <div className="empty-state">
          <div className="big">📍</div>
          <h2>Pick a point</h2>
          <p>
            Click anywhere on the water to screen a site. The score, the measured
            facts, and your editable criteria all appear here.
          </p>
        </div>
        <CriteriaEditor
          rubric={rubric}
          defaultRubric={defaultRubric}
          isForked={isForked}
          onChange={setRubric}
          onReset={editorProps.onReset}
        />
      </>
    );
  }

  const clickPoint =
    mode === "click" && pick && pickResult
      ? {
          lat: pick.location.lat,
          lng: pick.location.lng,
          color: scoreColor(pickResult),
        }
      : null;

  if (!rubric || !defaultRubric) {
    return (
      <div className="app">
        <Header userEmail={USER_EMAIL} liveData={liveData} />
        <div className="map-loading" style={{ position: "static", padding: 60 }}>
          Loading Kystkonsulent…
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header userEmail={USER_EMAIL} liveData={liveData} />
      <SearchBar
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        onSelectPlace={onSelectPlace}
        onScan={runScan}
        scanReady={!!rubric}
        scanning={loading && mode === "scan"}
      />
      <div className="columns">
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          projectTypes={projectTypes}
          projectTypeId={projectTypeId}
          onProjectChange={onProjectChange}
          onEditCriteria={() =>
            document
              .querySelector(".block.criteria")
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          isForked={isForked}
          layers={layers}
          onLayersChange={setLayers}
        />

        <MapView
          mode={mode}
          initialCenter={NORWAY_CENTER}
          viewTarget={viewTarget}
          onPick={onPick}
          onMapMove={setMapCenter}
          clickPoint={clickPoint}
          scan={scan}
          scanCenter={scanRaw?.center ?? null}
          activeIndex={activeIndex}
          onSelectCandidate={selectCandidate}
          layers={layers}
          loading={loading}
        />

        <div className="rightpanel">
          <div className="rp-scroll">{renderRightPanel()}</div>
          <Disclaimer />
        </div>
      </div>

      {error && <div className="toast">{error}</div>}
    </div>
  );
}
