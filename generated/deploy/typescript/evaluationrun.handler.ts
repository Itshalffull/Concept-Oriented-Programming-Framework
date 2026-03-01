// generated: evaluationrun.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./evaluationrun.types";

export interface EvaluationRunHandler {
  runEval(input: T.EvaluationRunRunEvalInput, storage: ConceptStorage):
    Promise<T.EvaluationRunRunEvalOutput>;
  logMetric(input: T.EvaluationRunLogMetricInput, storage: ConceptStorage):
    Promise<T.EvaluationRunLogMetricOutput>;
  pass(input: T.EvaluationRunPassInput, storage: ConceptStorage):
    Promise<T.EvaluationRunPassOutput>;
  fail(input: T.EvaluationRunFailInput, storage: ConceptStorage):
    Promise<T.EvaluationRunFailOutput>;
  getResult(input: T.EvaluationRunGetResultInput, storage: ConceptStorage):
    Promise<T.EvaluationRunGetResultOutput>;
}
