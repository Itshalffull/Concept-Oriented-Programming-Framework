// generated: designtoken.types.ts

export interface DesignTokenDefineInput {
  token: string;
  name: string;
  value: string;
  type: string;
  tier: string;
}

export type DesignTokenDefineOutput =
  { variant: "ok"; token: string }
  | { variant: "duplicate"; message: string };

export interface DesignTokenAliasInput {
  token: string;
  name: string;
  reference: string;
  tier: string;
}

export type DesignTokenAliasOutput =
  { variant: "ok"; token: string }
  | { variant: "notfound"; message: string }
  | { variant: "cycle"; message: string };

export interface DesignTokenResolveInput {
  token: string;
}

export type DesignTokenResolveOutput =
  { variant: "ok"; token: string; resolvedValue: string }
  | { variant: "notfound"; message: string }
  | { variant: "broken"; message: string; brokenAt: string };

export interface DesignTokenUpdateInput {
  token: string;
  value: string | null;
}

export type DesignTokenUpdateOutput =
  { variant: "ok"; token: string }
  | { variant: "notfound"; message: string };

export interface DesignTokenRemoveInput {
  token: string;
}

export type DesignTokenRemoveOutput =
  { variant: "ok"; token: string }
  | { variant: "notfound"; message: string };

export interface DesignTokenExportInput {
  format: string;
}

export type DesignTokenExportOutput =
  { variant: "ok"; output: string }
  | { variant: "unsupported"; message: string };

