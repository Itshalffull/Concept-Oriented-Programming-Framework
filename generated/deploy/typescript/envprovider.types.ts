// generated: envprovider.types.ts

export interface EnvProviderFetchInput {
  name: string;
}

export type EnvProviderFetchOutput =
  { variant: "ok"; value: string }
  | { variant: "variableNotSet"; name: string };

