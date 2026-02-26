// generated: outline.types.ts

export interface OutlineCreateInput {
  node: string;
  parent: string | null;
}

export type OutlineCreateOutput =
  { variant: "ok"; node: string }
  | { variant: "exists"; message: string };

export interface OutlineIndentInput {
  node: string;
}

export type OutlineIndentOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string }
  | { variant: "invalid"; message: string };

export interface OutlineOutdentInput {
  node: string;
}

export type OutlineOutdentOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string }
  | { variant: "invalid"; message: string };

export interface OutlineMoveUpInput {
  node: string;
}

export type OutlineMoveUpOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface OutlineMoveDownInput {
  node: string;
}

export type OutlineMoveDownOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface OutlineCollapseInput {
  node: string;
}

export type OutlineCollapseOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface OutlineExpandInput {
  node: string;
}

export type OutlineExpandOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface OutlineReparentInput {
  node: string;
  newParent: string;
}

export type OutlineReparentOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface OutlineGetChildrenInput {
  node: string;
}

export type OutlineGetChildrenOutput =
  { variant: "ok"; children: string }
  | { variant: "notfound"; message: string };

