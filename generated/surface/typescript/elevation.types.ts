// generated: elevation.types.ts

export interface ElevationDefineInput {
  elevation: string;
  level: number;
  shadow: string;
}

export type ElevationDefineOutput =
  { variant: "ok"; elevation: string }
  | { variant: "invalid"; message: string };

export interface ElevationGetInput {
  elevation: string;
}

export type ElevationGetOutput =
  { variant: "ok"; elevation: string; shadow: string }
  | { variant: "notfound"; message: string };

export interface ElevationGenerateScaleInput {
  baseColor: string;
}

export type ElevationGenerateScaleOutput =
  { variant: "ok"; shadows: string }
  | { variant: "invalid"; message: string };

