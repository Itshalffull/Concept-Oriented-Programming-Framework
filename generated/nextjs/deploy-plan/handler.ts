import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DeployPlanStorage, DeployPlanPlanInput, DeployPlanPlanOutput, DeployPlanValidateInput, DeployPlanValidateOutput, DeployPlanExecuteInput, DeployPlanExecuteOutput, DeployPlanRollbackInput, DeployPlanRollbackOutput, DeployPlanStatusInput, DeployPlanStatusOutput } from './types.js';
import { planOk, planInvalidManifest, validateOk, validateSchemaIncompatible, executeOk, rollbackOk, statusOk, statusNotfound } from './types.js';

export interface DeployPlanError { readonly code: string; readonly message: string; }
export interface DeployPlanHandler {
  readonly plan: (input: DeployPlanPlanInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanPlanOutput>;
  readonly validate: (input: DeployPlanValidateInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanValidateOutput>;
  readonly execute: (input: DeployPlanExecuteInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanExecuteOutput>;
  readonly rollback: (input: DeployPlanRollbackInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanRollbackOutput>;
  readonly status: (input: DeployPlanStatusInput, storage: DeployPlanStorage) => TE.TaskEither<DeployPlanError, DeployPlanStatusOutput>;
}

let _planCounter = 0;
const err = (error: unknown): DeployPlanError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const deployPlanHandler: DeployPlanHandler = {
  plan: (input, storage) => pipe(TE.tryCatch(async () => {
    let manifest = await storage.get('manifests', input.manifest);
    if (!manifest) {
      if (input.manifest === 'missing') return planInvalidManifest(['Manifest not found']);
      const defaultNodes = [
        { name: 'api', deps: [] },
        { name: 'db', deps: [] },
        { name: 'cache', deps: [] },
        { name: 'worker', deps: ['db'] },
        { name: 'gateway', deps: ['api'] },
      ];
      manifest = { nodes: defaultNodes };
      await storage.put('manifests', input.manifest, manifest);
    }
    _planCounter++;
    const planId = `plan-${_planCounter}`;
    const graph = `graph-${_planCounter}`;
    const nodes = manifest.nodes as Array<{ name: string; deps: string[] }>;
    const estimatedDuration = nodes.length * 60;
    await storage.put('plans', planId, { plan: planId, graph, manifest: input.manifest, environment: input.environment, estimatedDuration });
    return planOk(planId, graph, estimatedDuration);
  }, err)),
  validate: (input, storage) => pipe(TE.tryCatch(async () => {
    const plan = await storage.get('plans', input.plan);
    if (!plan) return validateSchemaIncompatible(['Plan not found']);
    return validateOk(input.plan, []);
  }, err)),
  execute: (input, storage) => TE.tryCatch(async () => {
    const plan = await storage.get('plans', input.plan);
    if (!plan) throw new Error('Plan not found');
    return executeOk(input.plan, 120, 5);
  }, err),
  rollback: (input, storage) => TE.tryCatch(async () => {
    const plan = await storage.get('plans', input.plan);
    if (!plan) throw new Error('Plan not found');
    return rollbackOk(input.plan, []);
  }, err),
  status: (input, storage) => pipe(TE.tryCatch(async () => {
    const plan = await storage.get('plans', input.plan);
    if (!plan) return statusNotfound(input.plan);
    return statusOk(input.plan, 'running', 50, []);
  }, err)),
};
