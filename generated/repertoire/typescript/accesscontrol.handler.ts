// generated: accesscontrol.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./accesscontrol.types";

export interface AccessControlHandler {
  check(input: T.AccessControlCheckInput, storage: ConceptStorage):
    Promise<T.AccessControlCheckOutput>;
  orIf(input: T.AccessControlOrIfInput, storage: ConceptStorage):
    Promise<T.AccessControlOrIfOutput>;
  andIf(input: T.AccessControlAndIfInput, storage: ConceptStorage):
    Promise<T.AccessControlAndIfOutput>;
}
