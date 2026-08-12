import { describe, expect, it } from "vitest";
import type { MaterialRegion } from "./types";
import {
  decomposeTravelingFields,
  normalizeMagneticField,
  relativeImpedanceAt,
  resolveVerticalLimit,
} from "./fieldMath";

const dielectric: MaterialRegion = {
  id: "dielectric",
  start: 1,
  end: 3,
  epsilonR: 4,
  muR: 1,
  sigmaE: 0,
  sigmaM: 0,
};

describe("field visualization physics", () => {
  it("uses the local wave impedance inside a dielectric region", () => {
    expect(relativeImpedanceAt([], 1)).toBe(1);
    expect(relativeImpedanceAt([dielectric], 0)).toBe(1);
    expect(relativeImpedanceAt([dielectric], 1)).toBe(0.5);
    expect(relativeImpedanceAt([dielectric], 2)).toBe(0.5);
    expect(relativeImpedanceAt([dielectric], 3)).toBe(1);
  });

  it("normalizes magnetic field with either vacuum or local impedance", () => {
    const eta0 = 376.730313668;
    const magnetic = new Float64Array([1 / eta0, 2 / eta0, 2 / eta0, 1 / eta0]);

    expect(Array.from(normalizeMagneticField(magnetic, [dielectric], "vacuum")))
      .toEqual([1, 2, 2, 1]);
    expect(Array.from(normalizeMagneticField(magnetic, [dielectric], "local")))
      .toEqual([1, 1, 1, 1]);
  });

  it("separates right-going and left-going electric fields", () => {
    const eta0 = 376.730313668;
    const electric = new Float64Array([1, 1, 1]);
    const magnetic = new Float64Array([-1 / eta0, 1 / eta0, -2 / eta0]);
    const { rightGoing, leftGoing } = decomposeTravelingFields(
      electric,
      magnetic,
      [{ ...dielectric, start: 2, end: 3 }],
    );

    expect(Array.from(rightGoing)).toEqual([1, 0, 1]);
    expect(Array.from(leftGoing)).toEqual([0, 1, 0]);
  });

  it("keeps fixed limits stable and auto limits tied to visible traces", () => {
    const traces = [new Float64Array([-0.3, 0.4]), new Float64Array([0.75])];

    expect(resolveVerticalLimit(traces, "fixed", 1)).toBe(1);
    expect(resolveVerticalLimit(traces, "fixed", -2)).toBe(2);
    expect(resolveVerticalLimit(traces, "auto", 1)).toBe(0.75);
    expect(resolveVerticalLimit([], "auto", 1)).toBe(0.25);
  });
});
