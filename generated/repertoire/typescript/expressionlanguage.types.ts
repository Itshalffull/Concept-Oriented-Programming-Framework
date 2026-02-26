// generated: expressionlanguage.types.ts

export interface ExpressionLanguageRegisterLanguageInput {
  name: string;
  grammar: string;
}

export type ExpressionLanguageRegisterLanguageOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface ExpressionLanguageRegisterFunctionInput {
  name: string;
  implementation: string;
}

export type ExpressionLanguageRegisterFunctionOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface ExpressionLanguageRegisterOperatorInput {
  name: string;
  implementation: string;
}

export type ExpressionLanguageRegisterOperatorOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface ExpressionLanguageParseInput {
  expression: string;
  text: string;
  language: string;
}

export type ExpressionLanguageParseOutput =
  { variant: "ok"; ast: string }
  | { variant: "error" };

export interface ExpressionLanguageEvaluateInput {
  expression: string;
}

export type ExpressionLanguageEvaluateOutput =
  { variant: "ok"; result: string }
  | { variant: "notfound" };

export interface ExpressionLanguageTypeCheckInput {
  expression: string;
}

export type ExpressionLanguageTypeCheckOutput =
  { variant: "ok"; valid: boolean; errors: string }
  | { variant: "notfound" };

export interface ExpressionLanguageGetCompletionsInput {
  expression: string;
  cursor: number;
}

export type ExpressionLanguageGetCompletionsOutput =
  { variant: "ok"; completions: string }
  | { variant: "notfound" };

