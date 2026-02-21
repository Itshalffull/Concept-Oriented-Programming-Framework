// generated: view.types.ts

export interface ViewCreateInput {
  view: string;
  dataSource: string;
  layout: string;
}

export type ViewCreateOutput =
  { variant: "ok"; view: string }
  | { variant: "error"; message: string };

export interface ViewSetFilterInput {
  view: string;
  filter: string;
}

export type ViewSetFilterOutput =
  { variant: "ok"; view: string }
  | { variant: "notfound"; message: string };

export interface ViewSetSortInput {
  view: string;
  sort: string;
}

export type ViewSetSortOutput =
  { variant: "ok"; view: string }
  | { variant: "notfound"; message: string };

export interface ViewSetGroupInput {
  view: string;
  group: string;
}

export type ViewSetGroupOutput =
  { variant: "ok"; view: string }
  | { variant: "notfound"; message: string };

export interface ViewSetVisibleFieldsInput {
  view: string;
  fields: string;
}

export type ViewSetVisibleFieldsOutput =
  { variant: "ok"; view: string }
  | { variant: "notfound"; message: string };

export interface ViewChangeLayoutInput {
  view: string;
  layout: string;
}

export type ViewChangeLayoutOutput =
  { variant: "ok"; view: string }
  | { variant: "notfound"; message: string };

export interface ViewDuplicateInput {
  view: string;
}

export type ViewDuplicateOutput =
  { variant: "ok"; newView: string }
  | { variant: "notfound"; message: string };

export interface ViewEmbedInput {
  view: string;
}

export type ViewEmbedOutput =
  { variant: "ok"; embedCode: string }
  | { variant: "notfound"; message: string };

