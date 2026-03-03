import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DeployPlanStorage, DeployPlanPlanInput, DeployPlanPlanOutput, DeployPlanValidateInput, DeployPlanValidateOutput, DeployPlanExecuteInput, DeployPlanExecuteOutput } from './types.js';
import { planOk, validateOk, executeOk } from './types.js';

export interface DeployPlanError { readonly code: string; readonly message: string; }
export interface DeployPlanHandler {
  readonly plan: (input: DeployPlanPlanInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanPlanOutput>;
  readonly validate: (input: DeployPlanValidateInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanValidateOutput>;
  readonly execute: (input: DeployPlanExecuteInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanExecuteOutput>;
}

let _planCounter = 0;
const err = (error: unknown): DeployPlanError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const deployPlanHandler: DeployPlanHandler = {
  plan: (input, storage) => pipe(TE.tryCatch(async () => {
    _planCounter++;
    const plan = `plan-${_planCounter}`;
    const graph = `graph-${_planCounter}`;
    await storage.put('plans', plan, { plan, graph, manifest: input.manifest, environment: input.environment, estimatedDuration: 300 });
    return planOk(plan, graph, 300);
  }, err)),
  validate: (input, storage) => pipe(TE.tryCatch(async () => {
    return validateOk(input.plan, []);
  }, err)),
  execute: (input, storage) => pipe(TE.tryCatch(async () => {
    return executeOk(input.plan, 120, 5);
  }, err)),
};
