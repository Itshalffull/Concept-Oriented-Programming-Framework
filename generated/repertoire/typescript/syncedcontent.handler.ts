// generated: syncedcontent.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./syncedcontent.types";

export interface SyncedContentHandler {
  createReference(input: T.SyncedContentCreateReferenceInput, storage: ConceptStorage):
    Promise<T.SyncedContentCreateReferenceOutput>;
  editOriginal(input: T.SyncedContentEditOriginalInput, storage: ConceptStorage):
    Promise<T.SyncedContentEditOriginalOutput>;
  deleteReference(input: T.SyncedContentDeleteReferenceInput, storage: ConceptStorage):
    Promise<T.SyncedContentDeleteReferenceOutput>;
  convertToIndependent(input: T.SyncedContentConvertToIndependentInput, storage: ConceptStorage):
    Promise<T.SyncedContentConvertToIndependentOutput>;
}
