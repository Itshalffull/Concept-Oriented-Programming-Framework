// generated: k8sruntime.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./k8sruntime.types";

export interface K8sRuntimeHandler {
  provision(input: T.K8sRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.K8sRuntimeProvisionOutput>;
  deploy(input: T.K8sRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.K8sRuntimeDeployOutput>;
  setTrafficWeight(input: T.K8sRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.K8sRuntimeSetTrafficWeightOutput>;
  rollback(input: T.K8sRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.K8sRuntimeRollbackOutput>;
  destroy(input: T.K8sRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.K8sRuntimeDestroyOutput>;
}
