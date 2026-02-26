// generated: localruntime.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./localruntime.types";

export interface LocalRuntimeHandler {
  provision(input: T.LocalRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.LocalRuntimeProvisionOutput>;
  deploy(input: T.LocalRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.LocalRuntimeDeployOutput>;
  setTrafficWeight(input: T.LocalRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.LocalRuntimeSetTrafficWeightOutput>;
  rollback(input: T.LocalRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.LocalRuntimeRollbackOutput>;
  destroy(input: T.LocalRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.LocalRuntimeDestroyOutput>;
}
