// generated: processspec.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./processspec.types";

export interface ProcessSpecHandler {
  create(input: T.ProcessSpecCreateInput, storage: ConceptStorage):
    Promise<T.ProcessSpecCreateOutput>;
  publish(input: T.ProcessSpecPublishInput, storage: ConceptStorage):
    Promise<T.ProcessSpecPublishOutput>;
  deprecate(input: T.ProcessSpecDeprecateInput, storage: ConceptStorage):
    Promise<T.ProcessSpecDeprecateOutput>;
  update(input: T.ProcessSpecUpdateInput, storage: ConceptStorage):
    Promise<T.ProcessSpecUpdateOutput>;
  get(input: T.ProcessSpecGetInput, storage: ConceptStorage):
    Promise<T.ProcessSpecGetOutput>;
}
