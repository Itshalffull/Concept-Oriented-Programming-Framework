// generated: milestone.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./milestone.types";

export interface MilestoneHandler {
  define(input: T.MilestoneDefineInput, storage: ConceptStorage):
    Promise<T.MilestoneDefineOutput>;
  evaluate(input: T.MilestoneEvaluateInput, storage: ConceptStorage):
    Promise<T.MilestoneEvaluateOutput>;
  revoke(input: T.MilestoneRevokeInput, storage: ConceptStorage):
    Promise<T.MilestoneRevokeOutput>;
}
