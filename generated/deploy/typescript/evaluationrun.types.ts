// generated: evaluationrun.types.ts

export interface EvaluationRunRunEvalInput {
  stepRef: string;
  evaluatorType: string;
  input: string;
  threshold: number;
}

export type EvaluationRunRunEvalOutput =
  { variant: "ok"; eval: string; stepRef: string; evaluatorType: string };

export interface EvaluationRunLogMetricInput {
  eval: string;
  metricName: string;
  metricValue: number;
}

export type EvaluationRunLogMetricOutput =
  { variant: "ok"; eval: string };

export interface EvaluationRunPassInput {
  eval: string;
  score: number;
  feedback: string;
}

export type EvaluationRunPassOutput =
  { variant: "ok"; eval: string; stepRef: string };

export interface EvaluationRunFailInput {
  eval: string;
  score: number;
  feedback: string;
}

export type EvaluationRunFailOutput =
  { variant: "failed"; eval: string; stepRef: string; feedback: string };

export interface EvaluationRunGetResultInput {
  eval: string;
}

export type EvaluationRunGetResultOutput =
  | { variant: "ok"; eval: string; status: string; score: number; feedback: string }
  | { variant: "notFound"; eval: string };
