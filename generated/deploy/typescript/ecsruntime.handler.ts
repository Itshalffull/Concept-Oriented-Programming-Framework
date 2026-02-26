// generated: ecsruntime.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./ecsruntime.types";

export interface EcsRuntimeHandler {
  provision(input: T.EcsRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.EcsRuntimeProvisionOutput>;
  deploy(input: T.EcsRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.EcsRuntimeDeployOutput>;
  setTrafficWeight(input: T.EcsRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.EcsRuntimeSetTrafficWeightOutput>;
  rollback(input: T.EcsRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.EcsRuntimeRollbackOutput>;
  destroy(input: T.EcsRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.EcsRuntimeDestroyOutput>;
}
