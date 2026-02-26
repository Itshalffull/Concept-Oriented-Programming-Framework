// generated: anatomy.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./anatomy.types";

export interface AnatomyHandler {
  define(input: T.AnatomyDefineInput, storage: ConceptStorage):
    Promise<T.AnatomyDefineOutput>;
  getParts(input: T.AnatomyGetPartsInput, storage: ConceptStorage):
    Promise<T.AnatomyGetPartsOutput>;
  getSlots(input: T.AnatomyGetSlotsInput, storage: ConceptStorage):
    Promise<T.AnatomyGetSlotsOutput>;
  extend(input: T.AnatomyExtendInput, storage: ConceptStorage):
    Promise<T.AnatomyExtendOutput>;
}
