// generated: contentstorage.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./contentstorage.types";

export interface ContentStorageHandler {
  save(input: T.ContentStorageSaveInput, storage: ConceptStorage):
    Promise<T.ContentStorageSaveOutput>;
  load(input: T.ContentStorageLoadInput, storage: ConceptStorage):
    Promise<T.ContentStorageLoadOutput>;
  delete(input: T.ContentStorageDeleteInput, storage: ConceptStorage):
    Promise<T.ContentStorageDeleteOutput>;
  query(input: T.ContentStorageQueryInput, storage: ConceptStorage):
    Promise<T.ContentStorageQueryOutput>;
  generateSchema(input: T.ContentStorageGenerateSchemaInput, storage: ConceptStorage):
    Promise<T.ContentStorageGenerateSchemaOutput>;
}
