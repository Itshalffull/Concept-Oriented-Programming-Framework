// generated: cloudrunruntime.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./cloudrunruntime.types";

export interface CloudRunRuntimeHandler {
  provision(input: T.CloudRunRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.CloudRunRuntimeProvisionOutput>;
  deploy(input: T.CloudRunRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.CloudRunRuntimeDeployOutput>;
  setTrafficWeight(input: T.CloudRunRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.CloudRunRuntimeSetTrafficWeightOutput>;
  rollback(input: T.CloudRunRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.CloudRunRuntimeRollbackOutput>;
  destroy(input: T.CloudRunRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.CloudRunRuntimeDestroyOutput>;
}
