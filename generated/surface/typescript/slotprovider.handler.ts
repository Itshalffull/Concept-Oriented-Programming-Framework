// generated: slotprovider.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./slotprovider.types";

export interface SlotProviderHandler {
  initialize(input: T.SlotProviderInitializeInput, storage: ConceptStorage):
    Promise<T.SlotProviderInitializeOutput>;
  define(input: T.SlotProviderDefineInput, storage: ConceptStorage):
    Promise<T.SlotProviderDefineOutput>;
  fill(input: T.SlotProviderFillInput, storage: ConceptStorage):
    Promise<T.SlotProviderFillOutput>;
  clear(input: T.SlotProviderClearInput, storage: ConceptStorage):
    Promise<T.SlotProviderClearOutput>;
  getSlots(input: T.SlotProviderGetSlotsInput, storage: ConceptStorage):
    Promise<T.SlotProviderGetSlotsOutput>;
}
