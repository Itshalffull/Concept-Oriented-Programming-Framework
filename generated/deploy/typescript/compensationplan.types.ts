// generated: compensationplan.types.ts

export interface CompensationPlanRegisterInput {
  runRef: string;
  stepKey: string;
  actionDescriptor: string;
}

export type CompensationPlanRegisterOutput =
  { variant: "ok"; plan: string };

export interface CompensationPlanTriggerInput {
  runRef: string;
}

export type CompensationPlanTriggerOutput =
  | { variant: "ok"; plan: string }
  | { variant: "empty"; runRef: string }
  | { variant: "alreadyTriggered"; runRef: string };

export interface CompensationPlanExecuteNextInput {
  plan: string;
}

export type CompensationPlanExecuteNextOutput =
  | { variant: "ok"; plan: string; stepKey: string; actionDescriptor: string }
  | { variant: "allDone"; plan: string };

export interface CompensationPlanMarkCompensationFailedInput {
  plan: string;
  stepKey: string;
  error: string;
}

export type CompensationPlanMarkCompensationFailedOutput =
  { variant: "ok"; plan: string };
