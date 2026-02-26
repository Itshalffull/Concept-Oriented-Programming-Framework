// generated: component.types.ts

export interface ComponentRegisterInput {
  component: string;
  config: string;
}

export type ComponentRegisterOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface ComponentRenderInput {
  component: string;
  context: string;
}

export type ComponentRenderOutput =
  { variant: "ok"; output: string }
  | { variant: "notfound"; message: string };

export interface ComponentPlaceInput {
  component: string;
  region: string;
}

export type ComponentPlaceOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface ComponentSetVisibilityInput {
  component: string;
  visible: boolean;
}

export type ComponentSetVisibilityOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface ComponentEvaluateVisibilityInput {
  component: string;
  context: string;
}

export type ComponentEvaluateVisibilityOutput =
  { variant: "ok"; visible: boolean }
  | { variant: "notfound"; message: string };

