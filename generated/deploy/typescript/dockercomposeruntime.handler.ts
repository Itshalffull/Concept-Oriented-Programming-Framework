// generated: dockercomposeruntime.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./dockercomposeruntime.types";

export interface DockerComposeRuntimeHandler {
  provision(input: T.DockerComposeRuntimeProvisionInput, storage: ConceptStorage):
    Promise<T.DockerComposeRuntimeProvisionOutput>;
  deploy(input: T.DockerComposeRuntimeDeployInput, storage: ConceptStorage):
    Promise<T.DockerComposeRuntimeDeployOutput>;
  setTrafficWeight(input: T.DockerComposeRuntimeSetTrafficWeightInput, storage: ConceptStorage):
    Promise<T.DockerComposeRuntimeSetTrafficWeightOutput>;
  rollback(input: T.DockerComposeRuntimeRollbackInput, storage: ConceptStorage):
    Promise<T.DockerComposeRuntimeRollbackOutput>;
  destroy(input: T.DockerComposeRuntimeDestroyInput, storage: ConceptStorage):
    Promise<T.DockerComposeRuntimeDestroyOutput>;
}
