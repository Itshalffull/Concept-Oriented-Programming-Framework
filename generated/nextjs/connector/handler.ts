import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ConnectorStorage, ConnectorConfigureInput, ConnectorConfigureOutput, ConnectorTestInput, ConnectorTestOutput, ConnectorReadInput, ConnectorReadOutput } from './types.js';
import { configureOk, testOk, readOk } from './types.js';

export interface ConnectorError { readonly code: string; readonly message: string; }
export interface ConnectorHandler {
  readonly configure: (input: ConnectorConfigureInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorConfigureOutput>;
  readonly test: (input: ConnectorTestInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorTestOutput>;
  readonly read: (input: ConnectorReadInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorReadOutput>;
}

const err = (error: unknown): ConnectorError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const connectorHandler: ConnectorHandler = {
  configure: (input, storage) => pipe(TE.tryCatch(async () => {
    const connectorId = 'conn-1';
    await storage.put('connectors', connectorId, { connectorId, sourceId: input.sourceId, protocolId: input.protocolId, config: input.config });
    return configureOk(connectorId);
  }, err)),
  test: (input, storage) => pipe(TE.tryCatch(async () => {
    return testOk('connected');
  }, err)),
  read: (input, storage) => pipe(TE.tryCatch(async () => {
    return readOk('[{"id":1}]');
  }, err)),
};
