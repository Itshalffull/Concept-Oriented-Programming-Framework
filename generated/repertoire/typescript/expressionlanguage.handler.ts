// generated: expressionlanguage.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./expressionlanguage.types";

export interface ExpressionLanguageHandler {
  registerLanguage(input: T.ExpressionLanguageRegisterLanguageInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageRegisterLanguageOutput>;
  registerFunction(input: T.ExpressionLanguageRegisterFunctionInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageRegisterFunctionOutput>;
  registerOperator(input: T.ExpressionLanguageRegisterOperatorInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageRegisterOperatorOutput>;
  parse(input: T.ExpressionLanguageParseInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageParseOutput>;
  evaluate(input: T.ExpressionLanguageEvaluateInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageEvaluateOutput>;
  typeCheck(input: T.ExpressionLanguageTypeCheckInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageTypeCheckOutput>;
  getCompletions(input: T.ExpressionLanguageGetCompletionsInput, storage: ConceptStorage):
    Promise<T.ExpressionLanguageGetCompletionsOutput>;
}
