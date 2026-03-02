// generated: designtokenprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./designtokenprovider.types";

export interface DesignTokenProviderHandler {
  initialize(input: T.DesignTokenProviderInitializeInput, storage: ConceptStorage):
    Promise<T.DesignTokenProviderInitializeOutput>;
  resolve(input: T.DesignTokenProviderResolveInput, storage: ConceptStorage):
    Promise<T.DesignTokenProviderResolveOutput>;
  switchTheme(input: T.DesignTokenProviderSwitchThemeInput, storage: ConceptStorage):
    Promise<T.DesignTokenProviderSwitchThemeOutput>;
  getTokens(input: T.DesignTokenProviderGetTokensInput, storage: ConceptStorage):
    Promise<T.DesignTokenProviderGetTokensOutput>;
  export(input: T.DesignTokenProviderExportInput, storage: ConceptStorage):
    Promise<T.DesignTokenProviderExportOutput>;
}
