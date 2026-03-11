import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ConnectorStorage, ConnectorConfigureInput, ConnectorConfigureOutput, ConnectorTestInput, ConnectorTestOutput, ConnectorReadInput, ConnectorReadOutput, ConnectorWriteInput, ConnectorWriteOutput, ConnectorDiscoverInput, ConnectorDiscoverOutput } from './types.js';
import { configureOk, configureError, testOk, testNotfound, readOk, readNotfound, readError, writeOk, writeNotfound, discoverOk, discoverNotfound } from './types.js';

export interface ConnectorError { readonly code: string; readonly message: string; }
export interface ConnectorHandler {
  readonly configure: (input: ConnectorConfigureInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorConfigureOutput>;
  readonly test: (input: ConnectorTestInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorTestOutput>;
  readonly read: (input: ConnectorReadInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorReadOutput>;
  readonly write: (input: ConnectorWriteInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorWriteOutput>;
  readonly discover: (input: ConnectorDiscoverInput, storage: ConnectorStorage) => TE.TaskEither<ConnectorError, ConnectorDiscoverOutput>;
}

const SUPPORTED_PROTOCOLS = ['rest', 'graphql', 'grpc', 'file', 'database', 'mqtt', 'websocket'];
let _connectorCounter = 0;

const err = (error: unknown): ConnectorError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const connectorHandler: ConnectorHandler = {
  configure: (input, storage) => pipe(TE.tryCatch(async () => {
    // Validate protocol
    if (!SUPPORTED_PROTOCOLS.includes(input.protocolId)) {
      return configureError(`Unsupported protocol: ${input.protocolId}`);
    }
    // Validate config JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.config);
    } catch {
      return configureError('Invalid config JSON');
    }
    // Validate protocol-specific config
    if (input.protocolId === 'rest' && !parsed.baseUrl) {
      return configureError('REST connector requires baseUrl in config');
    }
    _connectorCounter++;
    const connectorId = `conn-${_connectorCounter}`;
    const aliasId = `conn-${input.sourceId}-${input.protocolId}`;
    const record = {
      connectorId,
      sourceId: input.sourceId,
      protocolId: input.protocolId,
      config: input.config,
    };
    await storage.put('connectors', connectorId, record);
    await storage.put('connectors', aliasId, record);
    return configureOk(connectorId);
  }, err)),
  test: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('connectors', input.connectorId);
    if (!record) return testNotfound(`Connector ${input.connectorId} not found`);
    return testOk('connected');
  }, err)),
  read: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('connectors', input.connectorId);
    if (!record) return readNotfound(`Connector ${input.connectorId} not found`);
    // Validate query JSON
    try {
      JSON.parse(input.query);
    } catch {
      return readError('Invalid query JSON');
    }
    const _config = JSON.parse(String(record.config));
    const data = '[{"id":1}]';
    return readOk(data);
  }, err)),
  write: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('connectors', input.connectorId);
    if (!record) return writeNotfound(`Connector ${input.connectorId} not found`);
    let items: unknown[];
    try {
      items = JSON.parse(input.data);
    } catch {
      items = [];
    }
    const count = Array.isArray(items) ? items.length : 0;
    return writeOk(count, 0, 0, 0);
  }, err)),
  discover: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('connectors', input.connectorId);
    if (!record) return discoverNotfound(`Connector ${input.connectorId} not found`);
    const streams = JSON.stringify({
      protocol: record.protocolId,
      source: record.sourceId,
      streams: [],
    });
    return discoverOk(streams);
  }, err)),
};
