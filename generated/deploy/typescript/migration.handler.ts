// generated: migration.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./migration.types";

export interface MigrationHandler {
  plan(input: T.MigrationPlanInput, storage: ConceptStorage):
    Promise<T.MigrationPlanOutput>;
  expand(input: T.MigrationExpandInput, storage: ConceptStorage):
    Promise<T.MigrationExpandOutput>;
  migrate(input: T.MigrationMigrateInput, storage: ConceptStorage):
    Promise<T.MigrationMigrateOutput>;
  contract(input: T.MigrationContractInput, storage: ConceptStorage):
    Promise<T.MigrationContractOutput>;
  status(input: T.MigrationStatusInput, storage: ConceptStorage):
    Promise<T.MigrationStatusOutput>;
}
