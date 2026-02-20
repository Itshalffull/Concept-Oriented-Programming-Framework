// generated: binding.types.ts

export interface BindingBindInput {
  binding: string;
  concept: string;
  mode: string;
}

export type BindingBindOutput =
  { variant: "ok"; binding: string }
  | { variant: "invalid"; message: string };

export interface BindingSyncInput {
  binding: string;
}

export type BindingSyncOutput =
  { variant: "ok"; binding: string }
  | { variant: "error"; message: string };

export interface BindingInvokeInput {
  binding: string;
  action: string;
  input: string;
}

export type BindingInvokeOutput =
  { variant: "ok"; binding: string; result: string }
  | { variant: "error"; message: string };

export interface BindingUnbindInput {
  binding: string;
}

export type BindingUnbindOutput =
  { variant: "ok"; binding: string }
  | { variant: "notfound"; message: string };

