// generated: automationrule.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./automationrule.types";

export interface AutomationRuleHandler {
  define(input: T.AutomationRuleDefineInput, storage: ConceptStorage):
    Promise<T.AutomationRuleDefineOutput>;
  enable(input: T.AutomationRuleEnableInput, storage: ConceptStorage):
    Promise<T.AutomationRuleEnableOutput>;
  disable(input: T.AutomationRuleDisableInput, storage: ConceptStorage):
    Promise<T.AutomationRuleDisableOutput>;
  evaluate(input: T.AutomationRuleEvaluateInput, storage: ConceptStorage):
    Promise<T.AutomationRuleEvaluateOutput>;
  execute(input: T.AutomationRuleExecuteInput, storage: ConceptStorage):
    Promise<T.AutomationRuleExecuteOutput>;
}
