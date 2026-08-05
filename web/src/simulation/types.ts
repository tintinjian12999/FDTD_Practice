export type Scale = "normalized" | "si";
export type SourceKind = "hard" | "additive" | "tfsf";
export type Direction = "right" | "left";
export type Termination = "pmc" | "mur1" | "matched";

export interface MaterialRegion {
  id: string;
  start: number;
  end: number;
  epsilonR: number;
  muR: number;
  sigmaE: number;
  sigmaM: number;
}

export interface SimulationConfig {
  scale: Scale;
  gridSize: number;
  timeSteps: number;
  courant: number;
  dx: number;
  dt: number;
  source: SourceKind;
  direction: Direction;
  sourceIndex: number;
  delay: number;
  width: number;
  amplitude: number;
  leftTermination: Termination;
  rightTermination: Termination;
  matchedThickness: number;
  gradingOrder: number;
  targetReflection: number;
  materials: MaterialRegion[];
  allowUnstable: boolean;
  maximumField: number;
}

export interface SimulationSnapshot {
  electric: Float64Array;
  magnetic: Float64Array;
  step: number;
  phase: number;
  status: number;
}

export const defaultSimulationConfig: SimulationConfig = {
  scale: "normalized",
  gridSize: 240,
  timeSteps: 900,
  courant: 0.9,
  dx: 1,
  dt: 0.9,
  source: "additive",
  direction: "right",
  sourceIndex: 55,
  delay: 42,
  width: 12,
  amplitude: 1,
  leftTermination: "mur1",
  rightTermination: "mur1",
  matchedThickness: 28,
  gradingOrder: 3,
  targetReflection: 1e-6,
  materials: [],
  allowUnstable: false,
  maximumField: 1e4,
};
