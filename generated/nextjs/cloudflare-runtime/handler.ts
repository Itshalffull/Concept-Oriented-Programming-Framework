import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { CloudflareRuntimeStorage, CloudflareRuntimeProvisionInput, CloudflareRuntimeProvisionOutput, CloudflareRuntimeDeployInput, CloudflareRuntimeDeployOutput } from './types.js';
import { provisionOk, deployOk } from './types.js';

export interface CloudflareRuntimeError { readonly code: string; readonly message: string; }
export interface CloudflareRuntimeHandler {
  readonly provision: (input: CloudflareRuntimeProvisionInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeProvisionOutput>;
  readonly deploy: (input: CloudflareRuntimeDeployInput, storage: CloudflareRuntimeStorage) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeDeployOutput>;
}

let _workerCounter = 0;
const err = (error: unknown): CloudflareRuntimeError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const cloudflareRuntimeHandler: CloudflareRuntimeHandler = {
  provision: (input, storage) => pipe(TE.tryCatch(async () => {
    _workerCounter++;
    const worker = `worker-${_workerCounter}`;
    const scriptName = `${input.concept.toLowerCase()}-worker`;
    const endpoint = `https://${scriptName}.workers.dev`;
    await storage.put('workers', worker, { worker, concept: input.concept, accountId: input.accountId, scriptName, endpoint, version: '0' });
    return provisionOk(worker, scriptName, endpoint);
  }, err)),
  deploy: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('workers', input.worker);
    const currentVersion = record ? Number(record.version ?? 0) : 0;
    const newVersion = String(currentVersion + 1);
    if (record) {
      await storage.put('workers', input.worker, { ...record, version: newVersion, scriptContent: input.scriptContent });
    }
    return deployOk(input.worker, newVersion);
  }, err)),
};
