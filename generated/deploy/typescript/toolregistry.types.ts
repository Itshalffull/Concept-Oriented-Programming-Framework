// generated: toolregistry.types.ts

export interface ToolRegistryRegisterInput {
  name: string;
  description: string;
  schema: string;
}

export type ToolRegistryRegisterOutput =
  | { variant: "ok"; tool: string; version: number }
  | { variant: "invalidSchema"; message: string };

export interface ToolRegistryDeprecateInput {
  tool: string;
}

export type ToolRegistryDeprecateOutput =
  { variant: "ok"; tool: string };

export interface ToolRegistryDisableInput {
  tool: string;
}

export type ToolRegistryDisableOutput =
  { variant: "ok"; tool: string };

export interface ToolRegistryAuthorizeInput {
  tool: string;
  model: string;
  processRef: string;
}

export type ToolRegistryAuthorizeOutput =
  { variant: "ok"; tool: string };

export interface ToolRegistryCheckAccessInput {
  tool: string;
  model: string;
  processRef: string;
}

export type ToolRegistryCheckAccessOutput =
  | { variant: "allowed"; tool: string; schema: string }
  | { variant: "denied"; tool: string; reason: string };

export interface ToolRegistryListActiveInput {
  processRef: string;
}

export type ToolRegistryListActiveOutput =
  { variant: "ok"; tools: string };
