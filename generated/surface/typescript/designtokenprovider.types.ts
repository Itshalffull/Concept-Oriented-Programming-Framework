// generated: designtokenprovider.types.ts

export interface DesignTokenProviderInitializeInput {
  config: Record<string, unknown>;
}

export type DesignTokenProviderInitializeOutput =
  { variant: "ok"; provider: string; pluginRef: string }
  | { variant: "configError"; message: string };

export interface DesignTokenProviderResolveInput {
  tokenPath: string;
  theme?: string;
}

export type DesignTokenProviderResolveOutput =
  { variant: "ok"; tokenPath: string; resolvedValue: string }
  | { variant: "notfound"; message: string }
  | { variant: "broken"; message: string; brokenAt: string };

export interface DesignTokenProviderSwitchThemeInput {
  theme: string;
}

export type DesignTokenProviderSwitchThemeOutput =
  { variant: "ok"; theme: string }
  | { variant: "notfound"; message: string };

export interface DesignTokenProviderGetTokensInput {
  filter?: Record<string, string>;
}

export type DesignTokenProviderGetTokensOutput =
  { variant: "ok"; tokens: Array<{ path: string; value: string; type: string }> };

export interface DesignTokenProviderExportInput {
  format: string;
  theme?: string;
}

export type DesignTokenProviderExportOutput =
  { variant: "ok"; output: string }
  | { variant: "unsupported"; message: string };
