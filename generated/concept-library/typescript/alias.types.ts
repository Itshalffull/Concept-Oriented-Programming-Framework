// generated: alias.types.ts

export interface AliasAddAliasInput {
  entity: string;
  name: string;
}

export type AliasAddAliasOutput =
  { variant: "ok"; entity: string; name: string }
  | { variant: "exists"; entity: string; name: string };

export interface AliasRemoveAliasInput {
  entity: string;
  name: string;
}

export type AliasRemoveAliasOutput =
  { variant: "ok"; entity: string; name: string }
  | { variant: "notfound"; entity: string; name: string };

export interface AliasResolveInput {
  name: string;
}

export type AliasResolveOutput =
  { variant: "ok"; entity: string }
  | { variant: "notfound"; name: string };

