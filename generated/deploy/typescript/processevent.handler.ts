// generated: processevent.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./processevent.types";

export interface ProcessEventHandler {
  append(input: T.ProcessEventAppendInput, storage: ConceptStorage):
    Promise<T.ProcessEventAppendOutput>;
  query(input: T.ProcessEventQueryInput, storage: ConceptStorage):
    Promise<T.ProcessEventQueryOutput>;
  queryByType(input: T.ProcessEventQueryByTypeInput, storage: ConceptStorage):
    Promise<T.ProcessEventQueryByTypeOutput>;
  getCursor(input: T.ProcessEventGetCursorInput, storage: ConceptStorage):
    Promise<T.ProcessEventGetCursorOutput>;
}
