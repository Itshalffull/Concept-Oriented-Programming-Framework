// generated: relation.types.ts

export interface RelationDefineRelationInput {
  relation: string;
  schema: string;
}

export type RelationDefineRelationOutput =
  { variant: "ok"; relation: string }
  | { variant: "exists"; relation: string };

export interface RelationLinkInput {
  relation: string;
  source: string;
  target: string;
}

export type RelationLinkOutput =
  { variant: "ok"; relation: string; source: string; target: string }
  | { variant: "invalid"; relation: string; message: string };

export interface RelationUnlinkInput {
  relation: string;
  source: string;
  target: string;
}

export type RelationUnlinkOutput =
  { variant: "ok"; relation: string; source: string; target: string }
  | { variant: "notfound"; relation: string; source: string; target: string };

export interface RelationGetRelatedInput {
  relation: string;
  entity: string;
}

export type RelationGetRelatedOutput =
  { variant: "ok"; related: string }
  | { variant: "notfound"; relation: string; entity: string };

export interface RelationDefineRollupInput {
  relation: string;
  formula: string;
}

export type RelationDefineRollupOutput =
  { variant: "ok"; relation: string; formula: string }
  | { variant: "notfound"; relation: string };

export interface RelationComputeRollupInput {
  relation: string;
  entity: string;
}

export type RelationComputeRollupOutput =
  { variant: "ok"; value: string }
  | { variant: "notfound"; relation: string; entity: string };

