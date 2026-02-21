// generated: fluxprovider.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./fluxprovider.types";

export interface FluxProviderHandler {
  emit(input: T.FluxProviderEmitInput, storage: ConceptStorage):
    Promise<T.FluxProviderEmitOutput>;
  reconciliationStatus(input: T.FluxProviderReconciliationStatusInput, storage: ConceptStorage):
    Promise<T.FluxProviderReconciliationStatusOutput>;
  helmRelease(input: T.FluxProviderHelmReleaseInput, storage: ConceptStorage):
    Promise<T.FluxProviderHelmReleaseOutput>;
}
