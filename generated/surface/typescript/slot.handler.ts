// generated: slot.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./slot.types";

export interface SlotHandler {
  define(input: T.SlotDefineInput, storage: ConceptStorage):
    Promise<T.SlotDefineOutput>;
  fill(input: T.SlotFillInput, storage: ConceptStorage):
    Promise<T.SlotFillOutput>;
  setDefault(input: T.SlotSetDefaultInput, storage: ConceptStorage):
    Promise<T.SlotSetDefaultOutput>;
  clear(input: T.SlotClearInput, storage: ConceptStorage):
    Promise<T.SlotClearOutput>;
}
