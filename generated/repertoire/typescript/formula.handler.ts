// generated: formula.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./formula.types";

export interface FormulaHandler {
  create(input: T.FormulaCreateInput, storage: ConceptStorage):
    Promise<T.FormulaCreateOutput>;
  evaluate(input: T.FormulaEvaluateInput, storage: ConceptStorage):
    Promise<T.FormulaEvaluateOutput>;
  getDependencies(input: T.FormulaGetDependenciesInput, storage: ConceptStorage):
    Promise<T.FormulaGetDependenciesOutput>;
  invalidate(input: T.FormulaInvalidateInput, storage: ConceptStorage):
    Promise<T.FormulaInvalidateOutput>;
  setExpression(input: T.FormulaSetExpressionInput, storage: ConceptStorage):
    Promise<T.FormulaSetExpressionOutput>;
}
