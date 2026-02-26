// generated: formula.types.ts

export interface FormulaCreateInput {
  formula: string;
  expression: string;
}

export type FormulaCreateOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface FormulaEvaluateInput {
  formula: string;
}

export type FormulaEvaluateOutput =
  { variant: "ok"; result: string }
  | { variant: "notfound" };

export interface FormulaGetDependenciesInput {
  formula: string;
}

export type FormulaGetDependenciesOutput =
  { variant: "ok"; deps: string }
  | { variant: "notfound" };

export interface FormulaInvalidateInput {
  formula: string;
}

export type FormulaInvalidateOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface FormulaSetExpressionInput {
  formula: string;
  expression: string;
}

export type FormulaSetExpressionOutput =
  { variant: "ok" }
  | { variant: "notfound" };

