// generated: automationrule.types.ts

export interface AutomationRuleDefineInput {
  rule: string;
  trigger: string;
  conditions: string;
  actions: string;
}

export type AutomationRuleDefineOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface AutomationRuleEnableInput {
  rule: string;
}

export type AutomationRuleEnableOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface AutomationRuleDisableInput {
  rule: string;
}

export type AutomationRuleDisableOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface AutomationRuleEvaluateInput {
  rule: string;
  event: string;
}

export type AutomationRuleEvaluateOutput =
  { variant: "ok"; matched: boolean }
  | { variant: "notfound"; message: string };

export interface AutomationRuleExecuteInput {
  rule: string;
  context: string;
}

export type AutomationRuleExecuteOutput =
  { variant: "ok"; result: string }
  | { variant: "notfound"; message: string };

