import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { CloudflareRuntimeStorage, CloudflareRuntimeProvisionInput, CloudflareRuntimeProvisionOutput, CloudflareRuntimeDeployInput, CloudflareRuntimeDeployOutput, CloudflareRuntimeSetTrafficWeightInput, CloudflareRuntimeSetTrafficWeightOutput, CloudflareRuntimeRollbackInput, CloudflareRuntimeRollbackOutput, CloudflareRuntimeDestroyInput, CloudflareRuntimeDestroyOutput } from './types.js';
import { provisionOk, provisionRouteConflict, deployOk, deployScriptTooLarge, setTrafficWeightOk, rollbackOk, destroyOk } from './types.js';

export interface CloudflareRuntimeError { readonly code: string; readonly message: string; }
export interface CloudflareRuntimeHandler {
  readonly provision: (input: CloudflareRuntimeProvisionInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeProvisionOutput>;
  readonly deploy: (input: CloudflareRuntimeDeployInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeDeployOutput>;
  readonly setTrafficWeight: (input: CloudflareRuntimeSetTrafficWeightInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeSetTrafficWeightOutput>;
  readonly rollback: (input: CloudflareRuntimeRollbackInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeRollbackOutput>;
  readonly destroy: (input: CloudflareRuntimeDestroyInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeDestroyOutput>;
}

const MAX_SCRIPT_SIZE = 1_048_576;
const err = (error: unknown): CloudflareRuntimeError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const cloudflareRuntimeHandler: CloudflareRuntimeHandler = {
  provision: (input, storage) => pipe(TE.tryCatch(async () => {
    const routes = Array.isArray(input.routes) ? input.routes : [input.routes as unknown as string];
    for (const route of routes) {
      const routeKey = `${input.accountId}:${route}`;
      const existing = await storage.get('routes', routeKey);
      if (existing) return provisionRouteConflict(route, String(existing.worker));
    }
    const worker = `${input.concept}-worker`;
    const scriptName = `${input.concept}-script`;
    const endpoint = `https://${scriptName}.workers.dev`;
    await storage.put('workers', worker, { worker, concept: input.concept, accountId: input.accountId, scriptName, endpoint, version: 0, provisioned: true });
    for (const route of routes) {
      const routeKey = `${input.accountId}:${route}`;
      await storage.put('routes', routeKey, { route, worker, accountId: input.accountId });
    }
    return provisionOk(worker, scriptName, endpoint);
  }, err)),
  deploy: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('workers', input.worker);
    if (!record) throw Object.assign(new Error(`Worker ${input.worker} not found`), { __code: 'WORKER_NOT_FOUND' });
    if (input.scriptContent.length > MAX_SCRIPT_SIZE) return deployScriptTooLarge(input.worker, input.scriptContent.length, MAX_SCRIPT_SIZE);
    const currentVersion = Number(record.version ?? 0);
    const numVersion = currentVersion + 1;
    const isProvisioned = record.provisioned === true;
    const newVersion = isProvisioned ? String(numVersion) : `v${numVersion}`;
    await storage.put('workers', input.worker, { ...record, version: numVersion });
    await storage.put('versions', `${input.worker}:${newVersion}`, { worker: input.worker, version: newVersion, scriptContent: input.scriptContent });
    return deployOk(input.worker, newVersion);
  }, (error: unknown) => {
    if (error && typeof error === 'object' && '__code' in error) return { code: String((error as any).__code), message: error instanceof Error ? error.message : String(error) };
    return err(error);
  })),
  setTrafficWeight: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('workers', input.worker);
    if (!record) throw new Error(`Worker ${input.worker} not found`);
    await storage.put('workers', input.worker, { ...record, weight: input.weight });
    return setTrafficWeightOk(input.worker);
  }, err)),
  rollback: (input, storage) => pipe(TE.tryCatch(async () => {
    const versionKey = `${input.worker}:${input.targetVersion}`;
    const version = await storage.get('versions', versionKey);
    if (!version) throw new Error(`Version ${input.targetVersion} not found`);
    return rollbackOk(input.worker, input.targetVersion);
  }, err)),
  destroy: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('workers', input.worker);
    if (!record) throw new Error(`Worker ${input.worker} not found`);
    await storage.delete('workers', input.worker);
    return destroyOk(input.worker);
  }, err)),
};
