// generated: widget.types.ts

export interface WidgetRegisterInput {
  component: string;
  name: string;
  machineSpec: string;
  anatomy: string;
  a11ySpec: string;
}

export type WidgetRegisterOutput =
  { variant: "ok"; component: string }
  | { variant: "duplicate"; message: string };

export interface WidgetConfigureInput {
  component: string;
  config: string;
}

export type WidgetConfigureOutput =
  { variant: "ok"; component: string }
  | { variant: "notfound"; message: string };

export interface WidgetGetInput {
  component: string;
}

export type WidgetGetOutput =
  { variant: "ok"; component: string; machineSpec: string; anatomy: string; a11ySpec: string }
  | { variant: "notfound"; message: string };

export interface WidgetListInput {
  category: string | null;
}

export type WidgetListOutput =
  { variant: "ok"; components: string };

export interface WidgetUnregisterInput {
  component: string;
}

export type WidgetUnregisterOutput =
  { variant: "ok"; component: string }
  | { variant: "notfound"; message: string };

