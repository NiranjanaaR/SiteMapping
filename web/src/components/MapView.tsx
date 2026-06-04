import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { scoreColor } from "../colors";
import type { InputMode, LatLng, ScanResult } from "../types";
import type { LayerState } from "./Sidebar";

export interface ViewTarget {
  lat: number;
  lng: number;
  zoom: number;
  id: number;
}

interface Props {
  mode: InputMode;
  initialCenter: LatLng;
  viewTarget: ViewTarget | null;
  onPick: (lat: number, lng: number) => void;
  onMapMove: (center: LatLng) => void;
  clickPoint: { lat: number; lng: number; color: string } | null;
  scan: ScanResult | null;
  scanCenter: LatLng | null;
  activeIndex: number | null;
  onSelectCandidate: (i: number) => void;
  layers: LayerState;
  loading: boolean;
}

function ClickHandler({
  enabled,
  onPick,
  onMapMove,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
  onMapMove: (c: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
    moveend(e) {
      const c = e.target.getCenter();
      onMapMove({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

function ViewController({ target }: { target: ViewTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function MapView({
  mode,
  initialCenter,
  viewTarget,
  onPick,
  onMapMove,
  clickPoint,
  scan,
  scanCenter,
  activeIndex,
  onSelectCandidate,
  layers,
  loading,
}: Props) {
  const radiusM = scan ? scan.radiusKm * 1000 : 0;

  return (
    <div className="map-wrap">
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={6}
        minZoom={4}
        maxZoom={18}
        scrollWheelZoom
      >
        <LayersControl position="topright">
          {/* Clean, pale basemap — same look as tidevannstabell.no (CARTO Positron). */}
          <LayersControl.BaseLayer checked name="Light (CARTO Positron)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Voyager (CARTO)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Kartverket topo">
            <TileLayer
              attribution='&copy; <a href="https://www.kartverket.no/">Kartverket</a>'
              url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <ClickHandler
          enabled={mode === "click"}
          onPick={onPick}
          onMapMove={onMapMove}
        />
        <ViewController target={viewTarget} />

        {/* Scan radius ring */}
        {scan && scanCenter && (
          <Circle
            center={[scanCenter.lat, scanCenter.lng]}
            radius={radiusM}
            pathOptions={{
              color: "#0e7490",
              weight: 2,
              fillOpacity: 0.04,
              dashArray: "6 6",
            }}
          />
        )}

        {/* Scan candidate dots */}
        {scan &&
          scan.candidates.map((c, i) => {
            const isActive = i === activeIndex;
            const color = scoreColor(c.result);
            return (
              <CircleMarker
                key={`${c.location.lat}-${c.location.lng}`}
                center={[c.location.lat, c.location.lng]}
                radius={isActive ? 11 : 7}
                pathOptions={{
                  color: isActive ? "#0b2a3a" : "#ffffff",
                  weight: isActive ? 3 : 1,
                  fillColor: color,
                  fillOpacity: 0.9,
                }}
                eventHandlers={{ click: () => onSelectCandidate(i) }}
              >
                {layers.protected && c.facts.inProtectedArea && (
                  <CircleMarker
                    center={[c.location.lat, c.location.lng]}
                    radius={isActive ? 15 : 11}
                    pathOptions={{
                      color: "#2e7d32",
                      weight: 2,
                      fill: false,
                      dashArray: "3 3",
                    }}
                  />
                )}
                <Tooltip direction="top" offset={[0, -6]}>
                  <b>
                    #{i + 1} · {c.result.excluded ? "Excluded" : c.result.score}
                  </b>{" "}
                  {c.result.verdict}
                  {layers.depth && c.facts.depth_m != null && (
                    <>
                      <br />
                      {c.facts.depth_m} m deep
                    </>
                  )}
                  {layers.shipping && c.facts.nearShippingLane && (
                    <>
                      <br />⚓ near shipping lane
                    </>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}

        {/* Single clicked point */}
        {clickPoint && (
          <CircleMarker
            center={[clickPoint.lat, clickPoint.lng]}
            radius={12}
            pathOptions={{
              color: "#0b2a3a",
              weight: 3,
              fillColor: clickPoint.color,
              fillOpacity: 0.9,
            }}
          />
        )}
      </MapContainer>

      {mode === "click" && (
        <div className="map-hint">📍 Click on water to screen a site</div>
      )}
      {mode === "scan" && !scan && (
        <div className="map-hint">
          🗺️ Search a place or pan the map, pick a radius, then “Scan area”
        </div>
      )}
      {mode === "describe" && !scan && (
        <div className="map-hint">
          💬 Describe your project on the right to auto-scan a region
        </div>
      )}

      <div className="map-legend">
        <div className="lg">
          <span className="dot" style={{ background: "#16915a" }} /> Recommended
          (≥70)
        </div>
        <div className="lg">
          <span className="dot" style={{ background: "#d98a00" }} /> Marginal
          (45–69)
        </div>
        <div className="lg">
          <span className="dot" style={{ background: "#cf4733" }} /> Poor (&lt;45)
        </div>
        <div className="lg">
          <span className="dot" style={{ background: "#6b1f30" }} /> Excluded
        </div>
      </div>

      {loading && <div className="map-loading">Crunching the numbers…</div>}
    </div>
  );
}
