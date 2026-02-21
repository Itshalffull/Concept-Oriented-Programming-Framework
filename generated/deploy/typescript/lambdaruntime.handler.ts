// generated: lambdaruntime.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./lambdaruntime.types";

export interface LambdaRuntimeHandler {
  provision(input: T.LambdaRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.LambdaRuntimeProvisionOutput>;
  deploy(input: T.LambdaRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.LambdaRuntimeDeployOutput>;
  setTrafficWeight(input: T.LambdaRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.LambdaRuntimeSetTrafficWeightOutput>;
  rollback(input: T.LambdaRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.LambdaRuntimeRollbackOutput>;
  destroy(input: T.LambdaRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.LambdaRuntimeDestroyOutput>;
}
