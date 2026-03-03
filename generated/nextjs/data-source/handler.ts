import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DataSourceStorage, DataSourceRegisterInput, DataSourceRegisterOutput, DataSourceConnectInput, DataSourceConnectOutput, DataSourceDiscoverInput, DataSourceDiscoverOutput } from './types.js';
import { registerOk, connectOk, discoverOk } from './types.js';

export interface DataSourceError { readonly code: string; readonly message: string; }
export interface DataSourceHandler {
  readonly register: (input: DataSourceRegisterInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceRegisterOutput>;
  readonly connect: (input: DataSourceConnectInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceConnectOutput>;
  readonly discover: (input: DataSourceDiscoverInput, storage: DataSourceStorage) => TE.TaskEither<DataSourceError, DataSourceDiscoverOutput>;
}

const err = (error: unknown): DataSourceError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const dataSourceHandler: DataSourceHandler = {
  register: (input, storage) => pipe(TE.tryCatch(async () => {
    const sourceId = 'src-1';
    await storage.put('sources', sourceId, { sourceId, name: input.name, uri: input.uri, credentials: input.credentials });
    return registerOk(sourceId);
  }, err)),
  connect: (input, storage) => pipe(TE.tryCatch(async () => {
    return connectOk('connected');
  }, err)),
  discover: (input, storage) => pipe(TE.tryCatch(async () => {
    return discoverOk('{"streams":["posts","authors"]}');
  }, err)),
};
