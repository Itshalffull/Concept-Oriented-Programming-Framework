// generated: pathauto.types.ts

export interface PathautoGenerateAliasInput {
  pattern: string;
  entity: string;
}

export type PathautoGenerateAliasOutput =
  { variant: "ok"; alias: string }
  | { variant: "notfound" };

export interface PathautoBulkGenerateInput {
  pattern: string;
  entities: string;
}

export type PathautoBulkGenerateOutput =
  { variant: "ok"; aliases: string }
  | { variant: "notfound" };

export interface PathautoCleanStringInput {
  input: string;
}

export type PathautoCleanStringOutput =
  { variant: "ok"; cleaned: string };

