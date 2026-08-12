import { advancedDetails } from "./advanced";
import { foundationDetails } from "./foundations";
import { numericsEngineeringDetails } from "./numericsEngineering";
import { sourceBoundaryDetails } from "./sourcesBoundaries";
import type { LessonDetail } from "./types";

export const lessonDetails: Record<string, LessonDetail> = {
  ...foundationDetails,
  ...sourceBoundaryDetails,
  ...numericsEngineeringDetails,
  ...advancedDetails,
};

export type { LessonDetail } from "./types";
