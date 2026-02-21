// generated: secret.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./secret.types";

export interface SecretHandler {
  resolve(input: T.SecretResolveInput, storage: ConceptStorage):
    Promise<T.SecretResolveOutput>;
  exists(input: T.SecretExistsInput, storage: ConceptStorage):
    Promise<T.SecretExistsOutput>;
  rotate(input: T.SecretRotateInput, storage: ConceptStorage):
    Promise<T.SecretRotateOutput>;
  invalidateCache(input: T.SecretInvalidateCacheInput, storage: ConceptStorage):
    Promise<T.SecretInvalidateCacheOutput>;
}
