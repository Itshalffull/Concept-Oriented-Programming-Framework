// generated: dotenvprovider.types.ts

export interface DotenvProviderFetchInput {
  name: string;
  filePath: string;
}

export type DotenvProviderFetchOutput =
  { variant: "ok"; value: string }
  | { variant: "fileNotFound"; filePath: string }
  | { variant: "parseError"; filePath: string; line: number; reason: string }
  | { variant: "variableNotSet"; name: string; filePath: string };

