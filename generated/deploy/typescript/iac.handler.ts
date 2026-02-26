// generated: iac.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./iac.types";

export interface IaCHandler {
  emit(input: T.IaCEmitInput, storage: ConceptStorage):
    Promise<T.IaCEmitOutput>;
  preview(input: T.IaCPreviewInput, storage: ConceptStorage):
    Promise<T.IaCPreviewOutput>;
  apply(input: T.IaCApplyInput, storage: ConceptStorage):
    Promise<T.IaCApplyOutput>;
  detectDrift(input: T.IaCDetectDriftInput, storage: ConceptStorage):
    Promise<T.IaCDetectDriftOutput>;
  teardown(input: T.IaCTeardownInput, storage: ConceptStorage):
    Promise<T.IaCTeardownOutput>;
}
