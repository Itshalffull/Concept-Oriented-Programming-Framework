// generated: template.types.ts

export interface TemplateDefineInput {
  template: string;
  body: string;
  variables: string;
}

export type TemplateDefineOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface TemplateInstantiateInput {
  template: string;
  values: string;
}

export type TemplateInstantiateOutput =
  { variant: "ok"; content: string }
  | { variant: "notfound"; message: string };

export interface TemplateRegisterTriggerInput {
  template: string;
  trigger: string;
}

export type TemplateRegisterTriggerOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface TemplateMergePropertiesInput {
  template: string;
  properties: string;
}

export type TemplateMergePropertiesOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

