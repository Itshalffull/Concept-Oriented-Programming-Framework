// generated: vercelruntime.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./vercelruntime.types";

export interface VercelRuntimeHandler {
  provision(input: T.VercelRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.VercelRuntimeProvisionOutput>;
  deploy(input: T.VercelRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.VercelRuntimeDeployOutput>;
  setTrafficWeight(input: T.VercelRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.VercelRuntimeSetTrafficWeightOutput>;
  rollback(input: T.VercelRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.VercelRuntimeRollbackOutput>;
  destroy(input: T.VercelRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.VercelRuntimeDestroyOutput>;
}
