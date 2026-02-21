// generated: intent.types.ts

export interface IntentDefineInput {
  intent: string;
  target: string;
  purpose: string;
  operationalPrinciple: string;
}

export type IntentDefineOutput =
  { variant: "ok"; intent: string }
  | { variant: "exists"; message: string };

export interface IntentUpdateInput {
  intent: string;
  purpose: string;
  operationalPrinciple: string;
}

export type IntentUpdateOutput =
  { variant: "ok"; intent: string }
  | { variant: "notfound"; message: string };

export interface IntentVerifyInput {
  intent: string;
}

export type IntentVerifyOutput =
  { variant: "ok"; valid: boolean; failures: string }
  | { variant: "notfound"; message: string };

export interface IntentDiscoverInput {
  query: string;
}

export type IntentDiscoverOutput =
  { variant: "ok"; matches: string };

export interface IntentSuggestFromDescriptionInput {
  description: string;
}

export type IntentSuggestFromDescriptionOutput =
  { variant: "ok"; suggested: string };

