// generated: argocdprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./argocdprovider.types";

export interface ArgoCDProviderHandler {
  emit(input: T.ArgoCDProviderEmitInput, storage: ConceptStorage):
    Promise<T.ArgoCDProviderEmitOutput>;
  reconciliationStatus(input: T.ArgoCDProviderReconciliationStatusInput, storage: ConceptStorage):
    Promise<T.ArgoCDProviderReconciliationStatusOutput>;
  syncWave(input: T.ArgoCDProviderSyncWaveInput, storage: ConceptStorage):
    Promise<T.ArgoCDProviderSyncWaveOutput>;
}
