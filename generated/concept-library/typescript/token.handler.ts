// generated: token.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./token.types";

export interface TokenHandler {
  replace(input: T.TokenReplaceInput, storage: ConceptStorage):
    Promise<T.TokenReplaceOutput>;
  getAvailableTokens(input: T.TokenGetAvailableTokensInput, storage: ConceptStorage):
    Promise<T.TokenGetAvailableTokensOutput>;
  scan(input: T.TokenScanInput, storage: ConceptStorage):
    Promise<T.TokenScanOutput>;
  registerProvider(input: T.TokenRegisterProviderInput, storage: ConceptStorage):
    Promise<T.TokenRegisterProviderOutput>;
}
