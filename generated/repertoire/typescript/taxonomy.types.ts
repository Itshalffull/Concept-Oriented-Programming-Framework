// generated: taxonomy.types.ts

export interface TaxonomyCreateVocabularyInput {
  vocab: string;
  name: string;
}

export type TaxonomyCreateVocabularyOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface TaxonomyAddTermInput {
  vocab: string;
  term: string;
  parent: string | null;
}

export type TaxonomyAddTermOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface TaxonomySetParentInput {
  vocab: string;
  term: string;
  parent: string;
}

export type TaxonomySetParentOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface TaxonomyTagEntityInput {
  entity: string;
  vocab: string;
  term: string;
}

export type TaxonomyTagEntityOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface TaxonomyUntagEntityInput {
  entity: string;
  vocab: string;
  term: string;
}

export type TaxonomyUntagEntityOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

