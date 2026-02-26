// generated: formbuilder.types.ts

export interface FormBuilderBuildFormInput {
  form: string;
  schema: string;
}

export type FormBuilderBuildFormOutput =
  { variant: "ok"; definition: string }
  | { variant: "error"; message: string };

export interface FormBuilderValidateInput {
  form: string;
  data: string;
}

export type FormBuilderValidateOutput =
  { variant: "ok"; valid: boolean; errors: string };

export interface FormBuilderProcessSubmissionInput {
  form: string;
  data: string;
}

export type FormBuilderProcessSubmissionOutput =
  { variant: "ok"; result: string }
  | { variant: "invalid"; message: string };

export interface FormBuilderRegisterWidgetInput {
  form: string;
  type: string;
  widget: string;
}

export type FormBuilderRegisterWidgetOutput =
  { variant: "ok"; form: string }
  | { variant: "exists"; message: string };

export interface FormBuilderGetWidgetInput {
  form: string;
  type: string;
}

export type FormBuilderGetWidgetOutput =
  { variant: "ok"; widget: string }
  | { variant: "notfound"; message: string };

