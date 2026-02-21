// generated: gcfruntime.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./gcfruntime.types";

export interface GcfRuntimeHandler {
  provision(input: T.GcfRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.GcfRuntimeProvisionOutput>;
  deploy(input: T.GcfRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.GcfRuntimeDeployOutput>;
  setTrafficWeight(input: T.GcfRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.GcfRuntimeSetTrafficWeightOutput>;
  rollback(input: T.GcfRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.GcfRuntimeRollbackOutput>;
  destroy(input: T.GcfRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.GcfRuntimeDestroyOutput>;
}
