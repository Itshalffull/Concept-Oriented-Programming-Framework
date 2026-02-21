// generated: contentnode.types.ts

export interface ContentNodeCreateInput {
  node: string;
  type: string;
  content: string;
  createdBy: string;
}

export type ContentNodeCreateOutput =
  { variant: "ok"; node: string }
  | { variant: "exists"; message: string };

export interface ContentNodeUpdateInput {
  node: string;
  content: string;
}

export type ContentNodeUpdateOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface ContentNodeDeleteInput {
  node: string;
}

export type ContentNodeDeleteOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface ContentNodeGetInput {
  node: string;
}

export type ContentNodeGetOutput =
  { variant: "ok"; node: string; type: string; content: string; metadata: string }
  | { variant: "notfound"; message: string };

export interface ContentNodeSetMetadataInput {
  node: string;
  metadata: string;
}

export type ContentNodeSetMetadataOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

export interface ContentNodeChangeTypeInput {
  node: string;
  type: string;
}

export type ContentNodeChangeTypeOutput =
  { variant: "ok"; node: string }
  | { variant: "notfound"; message: string };

