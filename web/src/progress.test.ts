import { describe, expect, it } from "vitest";
import { parseProgress, serializeProgress } from "./progress";

describe("learning progress", () => {
  it("round-trips valid local progress", () => {
    const progress = {
      version: 1 as const,
      completedLessonIds: ["yee-grid", "yee-grid", "courant"],
      lastLessonId: "courant",
    };
    expect(parseProgress(serializeProgress(progress))).toEqual({
      ...progress,
      completedLessonIds: ["yee-grid", "courant"],
    });
  });

  it("rejects malformed imports", () => {
    expect(parseProgress("not json")).toBeNull();
    expect(parseProgress('{"version":2}')).toBeNull();
  });
});
