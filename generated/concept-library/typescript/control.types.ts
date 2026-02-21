// generated: control.types.ts

export interface ControlCreateInput {
  control: string;
  type: string;
  binding: string;
}

export type ControlCreateOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface ControlInteractInput {
  control: string;
  input: string;
}

export type ControlInteractOutput =
  { variant: "ok"; result: string }
  | { variant: "notfound"; message: string };

export interface ControlGetValueInput {
  control: string;
}

export type ControlGetValueOutput =
  { variant: "ok"; value: string }
  | { variant: "notfound"; message: string };

export interface ControlSetValueInput {
  control: string;
  value: string;
}

export type ControlSetValueOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface ControlTriggerActionInput {
  control: string;
}

export type ControlTriggerActionOutput =
  { variant: "ok"; result: string }
  | { variant: "notfound"; message: string };

