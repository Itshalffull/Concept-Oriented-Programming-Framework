// generated: health.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./health.types";

export interface HealthHandler {
  checkConcept(input: T.HealthCheckConceptInput, storage: ConceptStorage):
    Promise<T.HealthCheckConceptOutput>;
  checkSync(input: T.HealthCheckSyncInput, storage: ConceptStorage):
    Promise<T.HealthCheckSyncOutput>;
  checkKit(input: T.HealthCheckKitInput, storage: ConceptStorage):
    Promise<T.HealthCheckKitOutput>;
  checkInvariant(input: T.HealthCheckInvariantInput, storage: ConceptStorage):
    Promise<T.HealthCheckInvariantOutput>;
}
