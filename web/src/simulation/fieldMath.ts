import type { MaterialRegion } from "./types";

export const ETA0 = 376.730313668;
export type MagneticNormalization = "local" | "vacuum";
export type VerticalScaleMode = "fixed" | "auto";

export function relativeImpedanceAt(
  materials: MaterialRegion[],
  index: number,
): number {
  const material = materials.find(
    (region) => index >= region.start && index < region.end,
  );
  return material
    ? Math.sqrt(material.muR / material.epsilonR)
    : 1;
}

export function normalizeMagneticField(
  magnetic: Float64Array,
  materials: MaterialRegion[],
  normalization: MagneticNormalization,
): Float64Array {
  return Float64Array.from(magnetic, (value, index) => {
    const relativeImpedance = normalization === "local"
      ? relativeImpedanceAt(materials, index)
      : 1;
    return value * ETA0 * relativeImpedance;
  });
}

export function decomposeTravelingFields(
  electric: Float64Array,
  magnetic: Float64Array,
  materials: MaterialRegion[],
): { rightGoing: Float64Array; leftGoing: Float64Array } {
  const localMagnetic = normalizeMagneticField(magnetic, materials, "local");
  const rightGoing = new Float64Array(electric.length);
  const leftGoing = new Float64Array(electric.length);
  for (let index = 0; index < electric.length; index += 1) {
    rightGoing[index] = 0.5 * (electric[index] - localMagnetic[index]);
    leftGoing[index] = 0.5 * (electric[index] + localMagnetic[index]);
  }
  return { rightGoing, leftGoing };
}

export function resolveVerticalLimit(
  traces: Float64Array[],
  mode: VerticalScaleMode,
  fixedLimit: number,
): number {
  if (mode === "fixed") return Math.max(1e-6, Math.abs(fixedLimit));
  let maximum = 0.25;
  for (const trace of traces) {
    for (const value of trace) maximum = Math.max(maximum, Math.abs(value));
  }
  return maximum;
}
