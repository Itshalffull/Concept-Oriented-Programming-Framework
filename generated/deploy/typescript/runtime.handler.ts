// generated: runtime.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./runtime.types";

export interface RuntimeHandler {
  provision(input: T.RuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.RuntimeProvisionOutput>;
  deploy(input: T.RuntimeDeployInput, storage: ConceptStorage):
    Promise<T.RuntimeDeployOutput>;
  setTrafficWeight(input: T.RuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.RuntimeSetTrafficWeightOutput>;
  rollback(input: T.RuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.RuntimeRollbackOutput>;
  destroy(input: T.RuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.RuntimeDestroyOutput>;
  healthCheck(input: T.RuntimeHealthCheckInput, storage: ConceptStorage):
    Promise<T.RuntimeHealthCheckOutput>;
}
