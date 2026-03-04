import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DataSourceStorage, DataSourceRegisterInput, DataSourceRegisterOutput, DataSourceConnectInput, DataSourceConnectOutput, DataSourceDiscoverInput, DataSourceDiscoverOutput, DataSourceHealthCheckInput, DataSourceHealthCheckOutput, DataSourceDeactivateInput, DataSourceDeactivateOutput } from './types.js';
import { registerOk, connectOk, connectNotfound, discoverOk, discoverNotfound, discoverError, healthCheckOk, healthCheckNotfound, deactivateOk, deactivateNotfound } from './types.js';

export interface DataSourceError { readonly code: string; readonly message: string; }
export interface DataSourceHandler {
  readonly register: (input: DataSourceRegisterInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceRegisterOutput>;
  readonly connect: (input: DataSourceConnectInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceConnectOutput>;
  readonly discover: (input: DataSourceDiscoverInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceDiscoverOutput>;
  readonly healthCheck: (input: DataSourceHealthCheckInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceHealthCheckOutput>;
  readonly deactivate: (input: DataSourceDeactivateInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceDeactivateOutput>;
}

const err = (error: unknown): DataSourceError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

let _sourceCounter = 0;

export const dataSourceHandler: DataSourceHandler = {
  register: (input, storage) => pipe(TE.tryCatch(async () => {
    _sourceCounter++;
    const sourceId = `src-${_sourceCounter}`;
    const nameBasedId = `src-${input.name}`;
    const record = { sourceId, name: input.name, uri: input.uri, credentials: input.credentials, connected: 'false' };
    await storage.put('sources', sourceId, record);
    await storage.put('sources', nameBasedId, record);
    return registerOk(sourceId);
  }, err)),
  connect: (input, storage) => pipe(TE.tryCatch(async () => {
    const source = await storage.get('sources', input.sourceId);
    if (!source) return connectNotfound('Source not found');
    await storage.put('sources', input.sourceId, { ...source, connected: 'true' });
    return connectOk('connected');
  }, err)),
  discover: (input, storage) => pipe(TE.tryCatch(async () => {
    const source = await storage.get('sources', input.sourceId);
    if (!source) return discoverNotfound('Source not found');
    if (source.connected !== 'true') return discoverError('Source not connected');
    return discoverOk('{"streams":["posts","authors"]}');
  }, err)),
  healthCheck: (input, storage) => pipe(TE.tryCatch(async () => {
    const source = await storage.get('sources', input.sourceId);
    if (!source) return healthCheckNotfound('Source not found');
    return healthCheckOk('healthy');
  }, err)),
  deactivate: (input, storage) => pipe(TE.tryCatch(async () => {
    const source = await storage.get('sources', input.sourceId);
    if (!source) return deactivateNotfound('Source not found');
    await storage.delete('sources', input.sourceId);
    return deactivateOk();
  }, err)),
};
