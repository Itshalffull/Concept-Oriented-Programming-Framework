// generated: toolchain.types.ts

export interface ToolchainResolveInput {
  language: string;
  platform: string;
  versionConstraint: string | undefined;
}

export type ToolchainResolveOutput =
  { variant: "ok"; tool: string; version: string; path: string; capabilities: string[] }
  | { variant: "notInstalled"; language: string; platform: string; installHint: string }
  | { variant: "versionMismatch"; language: string; installed: string; required: string }
  | { variant: "platformUnsupported"; language: string; platform: string };

export interface ToolchainValidateInput {
  tool: string;
}

export type ToolchainValidateOutput =
  { variant: "ok"; tool: string; version: string }
  | { variant: "invalid"; tool: string; reason: string };

export interface ToolchainListInput {
  language: string | undefined;
}

export type ToolchainListOutput =
  { variant: "ok"; tools: { language: string; platform: string; version: string; path: string; status: string }[] };

export interface ToolchainCapabilitiesInput {
  tool: string;
}

export type ToolchainCapabilitiesOutput =
  { variant: "ok"; capabilities: string[] };
