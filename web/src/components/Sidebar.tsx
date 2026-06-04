import type { InputMode, ProjectType, ProjectTypeId } from "../types";

export interface LayerState {
  protected: boolean;
  shipping: boolean;
  depth: boolean;
}

interface Props {
  mode: InputMode;
  onModeChange: (m: InputMode) => void;
  projectTypes: ProjectType[];
  projectTypeId: ProjectTypeId;
  onProjectChange: (id: ProjectTypeId) => void;
  onEditCriteria: () => void;
  isForked: boolean;
  layers: LayerState;
  onLayersChange: (l: LayerState) => void;
}

const MODES: { id: InputMode; icon: string; title: string; desc: string }[] = [
  {
    id: "click",
    icon: "📍",
    title: "Click a point",
    desc: "Inspect one site’s full report.",
  },
  {
    id: "scan",
    icon: "🗺️",
    title: "Scan an area",
    desc: "Rank candidate sites across a radius.",
  },
  {
    id: "describe",
    icon: "💬",
    title: "Describe a project",
    desc: "Natural-language intake (coming soon).",
  },
];

const LAYER_META: { key: keyof LayerState; label: string; color: string }[] = [
  { key: "protected", label: "Protected areas", color: "#2e7d32" },
  { key: "shipping", label: "Shipping lanes", color: "#b23423" },
  { key: "depth", label: "Depth (bathymetry)", color: "#2563a8" },
];

export default function Sidebar({
  mode,
  onModeChange,
  projectTypes,
  projectTypeId,
  onProjectChange,
  onEditCriteria,
  isForked,
  layers,
  onLayersChange,
}: Props) {
  const current = projectTypes.find((p) => p.id === projectTypeId);

  return (
    <aside className="sidebar">
      <div className="group">
        <div className="label">Mode</div>
        <div className="mode-list">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-btn ${m.id === mode ? "active" : ""}`}
              onClick={() => onModeChange(m.id)}
              disabled={m.id === "describe"}
              title={m.id === "describe" ? "Planned — built last (spec §8)" : ""}
            >
              <span className="micon" aria-hidden>
                {m.icon}
              </span>
              <span>
                <span className="mtitle">{m.title}</span>
                <br />
                <span className="mdesc">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <div className="label">Project type</div>
        <select
          className="project-select"
          value={projectTypeId}
          onChange={(e) => onProjectChange(e.target.value as ProjectTypeId)}
          aria-label="Project type"
        >
          {projectTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {current && <p className="project-blurb">{current.blurb}</p>}
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 12 }}
          onClick={onEditCriteria}
        >
          ✏️ Edit criteria{isForked ? " ·" : ""}
          {isForked && <span className="forked-tag" style={{ marginLeft: 8 }}>edited</span>}
        </button>
      </div>

      <div className="group">
        <div className="label">Map layers</div>
        {LAYER_META.map((l) => (
          <label key={l.key} className="layer-toggle">
            <input
              type="checkbox"
              checked={layers[l.key]}
              onChange={(e) =>
                onLayersChange({ ...layers, [l.key]: e.target.checked })
              }
            />
            <span className="swatch" style={{ background: l.color }} />
            <span>{l.label}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}
