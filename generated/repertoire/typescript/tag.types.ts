// generated: tag.types.ts

export interface TagAddTagInput {
  entity: string;
  tag: string;
}

export type TagAddTagOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface TagRemoveTagInput {
  entity: string;
  tag: string;
}

export type TagRemoveTagOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface TagGetByTagInput {
  tag: string;
}

export type TagGetByTagOutput =
  { variant: "ok"; entities: string };

export interface TagGetChildrenInput {
  tag: string;
}

export type TagGetChildrenOutput =
  { variant: "ok"; children: string }
  | { variant: "notfound"; message: string };

export interface TagRenameInput {
  tag: string;
  name: string;
}

export type TagRenameOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

