// generated: deployplan.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./deployplan.types";

export interface DeployPlanHandler {
  plan(input: T.DeployPlanPlanInput, storage: ConceptStorage):
    Promise<T.DeployPlanPlanOutput>;
  validate(input: T.DeployPlanValidateInput, storage: ConceptStorage):
    Promise<T.DeployPlanValidateOutput>;
  execute(input: T.DeployPlanExecuteInput, storage: ConceptStorage):
    Promise<T.DeployPlanExecuteOutput>;
  rollback(input: T.DeployPlanRollbackInput, storage: ConceptStorage):
    Promise<T.DeployPlanRollbackOutput>;
  status(input: T.DeployPlanStatusInput, storage: ConceptStorage):
    Promise<T.DeployPlanStatusOutput>;
}
