// generated: gitops.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./gitops.types";

export interface GitOpsHandler {
  emit(input: T.GitOpsEmitInput, storage: ConceptStorage):
    Promise<T.GitOpsEmitOutput>;
  reconciliationStatus(input: T.GitOpsReconciliationStatusInput, storage: ConceptStorage):
    Promise<T.GitOpsReconciliationStatusOutput>;
}
