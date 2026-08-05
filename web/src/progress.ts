export const PROGRESS_KEY = "ufdtd-lab-progress-v1";

export interface LearningProgress {
  version: 1;
  completedLessonIds: string[];
  lastLessonId: string;
}

export function parseProgress(value: string | null): LearningProgress | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<LearningProgress>;
    if (
      candidate.version !== 1
      || !Array.isArray(candidate.completedLessonIds)
      || !candidate.completedLessonIds.every((item) => typeof item === "string")
      || typeof candidate.lastLessonId !== "string"
    ) {
      return null;
    }
    return {
      version: 1,
      completedLessonIds: [...new Set(candidate.completedLessonIds)],
      lastLessonId: candidate.lastLessonId,
    };
  } catch {
    return null;
  }
}

export function serializeProgress(progress: LearningProgress): string {
  return JSON.stringify(progress, null, 2);
}
