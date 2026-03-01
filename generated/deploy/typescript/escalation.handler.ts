// generated: escalation.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./escalation.types";

export interface EscalationHandler {
  escalate(input: T.EscalationEscalateInput, storage: ConceptStorage):
    Promise<T.EscalationEscalateOutput>;
  accept(input: T.EscalationAcceptInput, storage: ConceptStorage):
    Promise<T.EscalationAcceptOutput>;
  resolve(input: T.EscalationResolveInput, storage: ConceptStorage):
    Promise<T.EscalationResolveOutput>;
  reEscalate(input: T.EscalationReEscalateInput, storage: ConceptStorage):
    Promise<T.EscalationReEscalateOutput>;
}
