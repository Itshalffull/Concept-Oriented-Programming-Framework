// generated: flag.types.ts

export interface FlagFlagInput {
  flagging: string;
  flagType: string;
  entity: string;
  user: string;
}

export type FlagFlagOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface FlagUnflagInput {
  flagging: string;
}

export type FlagUnflagOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface FlagIsFlaggedInput {
  flagType: string;
  entity: string;
  user: string;
}

export type FlagIsFlaggedOutput =
  { variant: "ok"; flagged: boolean };

export interface FlagGetCountInput {
  flagType: string;
  entity: string;
}

export type FlagGetCountOutput =
  { variant: "ok"; count: number };

