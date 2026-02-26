// generated: exposedfilter.types.ts

export interface ExposedFilterExposeInput {
  filter: string;
  fieldName: string;
  operator: string;
  defaultValue: string;
}

export type ExposedFilterExposeOutput =
  { variant: "ok"; filter: string }
  | { variant: "exists"; filter: string };

export interface ExposedFilterCollectInputInput {
  filter: string;
  value: string;
}

export type ExposedFilterCollectInputOutput =
  { variant: "ok"; filter: string }
  | { variant: "notfound"; filter: string };

export interface ExposedFilterApplyToQueryInput {
  filter: string;
}

export type ExposedFilterApplyToQueryOutput =
  { variant: "ok"; queryMod: string }
  | { variant: "notfound"; filter: string };

export interface ExposedFilterResetToDefaultsInput {
  filter: string;
}

export type ExposedFilterResetToDefaultsOutput =
  { variant: "ok"; filter: string }
  | { variant: "notfound"; filter: string };

