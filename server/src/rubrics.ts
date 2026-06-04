// ---------------------------------------------------------------------------
// Default rubrics per project type (spec §5). These are LOCKED baselines —
// the client forks a copy to edit, and can always return to these.
// ---------------------------------------------------------------------------

import type { ProjectType, Rubric } from "./types.js";

const shippingPenalty = {
  when: "nearShippingLane",
  factor: 0.7,
  label: "Near a shipping lane",
};

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: "seaweed",
    label: "Seaweed / kelp",
    blurb: "Shallow, sheltered, cool water suits kelp longlines.",
    defaultRubric: {
      depth: { min: 5, max: 40 },
      temp: { min: 4, max: 16 },
      wave: { max: 2.0 },
      weights: { depth: 40, temp: 25, wave: 35 },
      hardExclusions: ["protectedArea"],
      softPenalties: [shippingPenalty],
    },
  },
  {
    id: "salmon",
    label: "Salmon aquaculture",
    blurb: "Deeper, flushed sites with moderate exposure for net pens.",
    defaultRubric: {
      depth: { min: 15, max: 60 },
      temp: { min: 6, max: 18 },
      wave: { max: 2.5 },
      weights: { depth: 40, temp: 25, wave: 35 },
      hardExclusions: ["protectedArea"],
      softPenalties: [shippingPenalty],
    },
  },
  {
    id: "buoy",
    label: "Sensor buoy",
    blurb: "Tolerant of depth and cold; mostly needs to stay out of the way.",
    defaultRubric: {
      depth: { min: 10, max: 400 },
      temp: { min: -2, max: 25 },
      wave: { max: 5.0 },
      weights: { depth: 40, temp: 25, wave: 35 },
      hardExclusions: ["protectedArea"],
      softPenalties: [shippingPenalty],
    },
  },
];

export function getProjectType(id: string): ProjectType | undefined {
  return PROJECT_TYPES.find((p) => p.id === id);
}

export function defaultRubricFor(id: string): Rubric | undefined {
  return getProjectType(id)?.defaultRubric;
}
