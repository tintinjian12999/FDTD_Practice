export interface ConceptBlock {
  title: string;
  paragraphs: string[];
  equation?: string;
  bullets?: string[];
}

export interface WorkedExample {
  title: string;
  given: string[];
  steps: string[];
  result: string;
}

export interface CodeBridge {
  title: string;
  explanation: string;
  snippet: string;
}

export interface ExperimentProtocol {
  goal: string;
  setup: string[];
  steps: string[];
  expected: string[];
  successCriteria: string[];
}

export interface SelfCheck {
  question: string;
  answer: string;
}

export interface LessonDetail {
  prerequisites: string[];
  concepts: ConceptBlock[];
  workedExample: WorkedExample;
  codeBridge: CodeBridge;
  experiment: ExperimentProtocol;
  misconceptions: Array<{ claim: string; correction: string }>;
  selfChecks: SelfCheck[];
}
