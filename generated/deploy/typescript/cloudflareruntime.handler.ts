// generated: cloudflareruntime.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./cloudflareruntime.types";

export interface CloudflareRuntimeHandler {
  provision(input: T.CloudflareRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.CloudflareRuntimeProvisionOutput>;
  deploy(input: T.CloudflareRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.CloudflareRuntimeDeployOutput>;
  setTrafficWeight(input: T.CloudflareRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.CloudflareRuntimeSetTrafficWeightOutput>;
  rollback(input: T.CloudflareRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.CloudflareRuntimeRollbackOutput>;
  destroy(input: T.CloudflareRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.CloudflareRuntimeDestroyOutput>;
}
