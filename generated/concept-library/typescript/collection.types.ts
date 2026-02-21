// generated: collection.types.ts

export interface CollectionCreateInput {
  collection: string;
  type: string;
  schema: string;
}

export type CollectionCreateOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface CollectionAddMemberInput {
  collection: string;
  member: string;
}

export type CollectionAddMemberOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface CollectionRemoveMemberInput {
  collection: string;
  member: string;
}

export type CollectionRemoveMemberOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface CollectionGetMembersInput {
  collection: string;
}

export type CollectionGetMembersOutput =
  { variant: "ok"; members: string }
  | { variant: "notfound" };

export interface CollectionSetSchemaInput {
  collection: string;
  schema: string;
}

export type CollectionSetSchemaOutput =
  { variant: "ok" }
  | { variant: "notfound" };

export interface CollectionCreateVirtualInput {
  collection: string;
  query: string;
}

export type CollectionCreateVirtualOutput =
  { variant: "ok" }
  | { variant: "exists" };

export interface CollectionMaterializeInput {
  collection: string;
}

export type CollectionMaterializeOutput =
  { variant: "ok"; members: string }
  | { variant: "notfound" };

