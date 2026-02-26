// generated: vaultprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./vaultprovider.types";

export interface VaultProviderHandler {
  fetch(input: T.VaultProviderFetchInput, storage: ConceptStorage):
    Promise<T.VaultProviderFetchOutput>;
  renewLease(input: T.VaultProviderRenewLeaseInput, storage: ConceptStorage):
    Promise<T.VaultProviderRenewLeaseOutput>;
  rotate(input: T.VaultProviderRotateInput, storage: ConceptStorage):
    Promise<T.VaultProviderRotateOutput>;
}
