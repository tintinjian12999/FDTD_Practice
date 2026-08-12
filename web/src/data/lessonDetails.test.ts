import { describe, expect, it } from "vitest";
import { lessons } from "./lessons";
import { lessonDetails } from "./lessonDetails";

describe("beginner-ready lesson content", () => {
  it("provides a complete teaching sequence for every lesson", () => {
    expect(Object.keys(lessonDetails)).toHaveLength(lessons.length);
    for (const lesson of lessons) {
      const detail = lessonDetails[lesson.id];
      expect(detail, lesson.id).toBeDefined();
      expect(detail.prerequisites.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(detail.concepts.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(detail.concepts.every((concept) => concept.paragraphs.length > 0), lesson.id).toBe(true);
      expect(detail.workedExample.steps.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(detail.codeBridge.snippet.length, lesson.id).toBeGreaterThan(20);
      expect(detail.experiment.steps.length, lesson.id).toBeGreaterThanOrEqual(4);
      expect(detail.experiment.expected.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(detail.experiment.successCriteria.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(detail.misconceptions.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(detail.selfChecks.length, lesson.id).toBeGreaterThanOrEqual(2);
    }
  });
});
