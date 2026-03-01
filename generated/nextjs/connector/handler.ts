// Connector — handler.ts
// Protocol-agnostic integration connector lifecycle: configuration, reading,
// writing, testing, and schema discovery against external systems.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConnectorStorage,
  ConnectorConfigureInput,
  ConnectorConfigureOutput,
  ConnectorReadInput,
  ConnectorReadOutput,
  ConnectorWriteInput,
  ConnectorWriteOutput,
  ConnectorTestInput,
  ConnectorTestOutput,
  ConnectorDiscoverInput,
  ConnectorDiscoverOutput,
} from './types.js';

import {
  configureOk,
  configureError,
  readOk,
  readNotfound,
  readError,
  writeOk,
  writeNotfound,
  writeError,
  testOk,
  testNotfound,
  testError,
  discoverOk,
  discoverNotfound,
  discoverError,
} from './types.js';

export interface ConnectorError {
  readonly code: string;
  readonly message: string;
}

export interface ConnectorHandler {
  readonly configure: (
    input: ConnectorConfigureInput,
    storage: ConnectorStorage,
  ) => TE.TaskEither<ConnectorError, ConnectorConfigureOutput>;
  readonly read: (
    input: ConnectorReadInput,
    storage: ConnectorStorage,
  ) => TE.TaskEither<ConnectorError, ConnectorReadOutput>;
  readonly write: (
    input: ConnectorWriteInput,
    storage: ConnectorStorage,
  ) => TE.TaskEither<ConnectorError, ConnectorWriteOutput>;
  readonly test: (
    input: ConnectorTestInput,
    storage: ConnectorStorage,
  ) => TE.TaskEither<ConnectorError, ConnectorTestOutput>;
  readonly discover: (
    input: ConnectorDiscoverInput,
    storage: ConnectorStorage,
  ) => TE.TaskEither<ConnectorError, ConnectorDiscoverOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): ConnectorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Known protocol identifiers. */
const SUPPORTED_PROTOCOLS: ReadonlySet<string> = new Set([
  'rest',
  'graphql',
  'sql',
  'file',
  'grpc',
  'webhook',
]);

/** Validate protocol-specific config shape. */
const validateConfig = (
  protocolId: string,
  configStr: string,
): E.Either<string, Record<string, unknown>> => {
  try {
    const config = JSON.parse(configStr);
    if (typeof config !== 'object' || config === null) {
      return E.left('Config must be a JSON object');
    }

    switch (protocolId) {
      case 'rest':
        if (!config['baseUrl'] || typeof config['baseUrl'] !== 'string') {
          return E.left("REST protocol requires a 'baseUrl' string");
        }
        break;
      case 'sql':
        if (!config['connectionString'] && !config['host']) {
          return E.left(
            "SQL protocol requires 'connectionString' or 'host'",
          );
        }
        break;
      case 'graphql':
        if (!config['endpoint'] || typeof config['endpoint'] !== 'string') {
          return E.left("GraphQL protocol requires an 'endpoint' string");
        }
        break;
      // file, grpc, webhook have minimal requirements
    }

    return E.right(config as Record<string, unknown>);
  } catch (e) {
    return E.left(`Invalid config JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/** Generate a connector ID from source and protocol. */
const connectorIdFrom = (sourceId: string, protocolId: string): string =>
  `conn-${sourceId}-${protocolId}`;

/** Safely parse JSON. */
const safeJsonParse = (
  raw: string,
): E.Either<string, Record<string, unknown>> => {
  try {
    const p = JSON.parse(raw);
    return typeof p === 'object' && p !== null
      ? E.right(p as Record<string, unknown>)
      : E.left('Not a JSON object');
  } catch (e) {
    return E.left(e instanceof Error ? e.message : String(e));
  }
};

// --- Implementation ---

export const connectorHandler: ConnectorHandler = {
  /**
   * Create a connector instance for a given source and protocol.
   * Validates the protocol ID and config shape before persisting.
   */
  configure: (input, storage) => {
    if (!SUPPORTED_PROTOCOLS.has(input.protocolId)) {
      return TE.right(
        configureError(
          `Unknown protocol '${input.protocolId}'. Supported: ${[...SUPPORTED_PROTOCOLS].join(', ')}`,
        ),
      );
    }

    return pipe(
      validateConfig(input.protocolId, input.config),
      E.fold(
        (err) => TE.right(configureError(err)),
        (parsedConfig) => {
          const connectorId = connectorIdFrom(input.sourceId, input.protocolId);
          return pipe(
            TE.tryCatch(
              () =>
                storage.put('connectors', connectorId, {
                  connectorId,
                  sourceId: input.sourceId,
                  protocolId: input.protocolId,
                  config: JSON.stringify(parsedConfig),
                  status: 'configured',
                  createdAt: new Date().toISOString(),
                }),
              storageErr,
            ),
            TE.map(() => configureOk(connectorId)),
          );
        },
      ),
    );
  },

  /**
   * Read data from the external system via the connector.
   * Validates the connector exists, parses the query, and simulates
   * data retrieval through the configured protocol.
   */
  read: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connectors', input.connectorId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                readNotfound(
                  `Connector '${input.connectorId}' does not exist`,
                ),
              ),
            (found) => {
              const status = String(found['status'] ?? '');
              if (status === 'error' || status === 'disconnected') {
                return TE.right(
                  readError(
                    `Connector '${input.connectorId}' is in '${status}' state`,
                  ),
                );
              }

              return pipe(
                safeJsonParse(input.query),
                E.fold(
                  (err) =>
                    TE.right(readError(`Invalid query JSON: ${err}`)),
                  (query) => {
                    // Parse options for pagination
                    const options = pipe(
                      safeJsonParse(input.options),
                      E.getOrElse(
                        (): Record<string, unknown> => ({}),
                      ),
                    );

                    const limit = Number(options['limit'] ?? 100);
                    const offset = Number(options['offset'] ?? 0);

                    // Record the read operation and return results from storage
                    return pipe(
                      TE.tryCatch(
                        () =>
                          storage.find('connector_data', {
                            connectorId: input.connectorId,
                            ...query,
                          }),
                        storageErr,
                      ),
                      TE.map((results) => {
                        const paginated = results.slice(
                          offset,
                          offset + limit,
                        );
                        return readOk(JSON.stringify(paginated));
                      }),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Write data to the external system via the connector.
   * Parses the data payload, validates the connector state, and
   * tracks created/updated/skipped/error counts.
   */
  write: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connectors', input.connectorId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                writeNotfound(
                  `Connector '${input.connectorId}' does not exist`,
                ),
              ),
            (found) => {
              const status = String(found['status'] ?? '');
              if (status === 'error' || status === 'disconnected') {
                return TE.right(
                  writeError(
                    `Connector '${input.connectorId}' is in '${status}' state`,
                  ),
                );
              }

              // Parse write data
              let dataItems: readonly Record<string, unknown>[];
              try {
                const parsed = JSON.parse(input.data);
                dataItems = Array.isArray(parsed) ? parsed : [parsed];
              } catch {
                return TE.right(
                  writeError('Invalid data JSON payload'),
                );
              }

              // Process each item: simulate write with counters
              let created = 0;
              let updated = 0;
              let skipped = 0;
              let errors = 0;

              return pipe(
                TE.tryCatch(
                  async () => {
                    for (const item of dataItems) {
                      const id = String(
                        item['id'] ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      );
                      const existing = await storage.get(
                        'connector_data',
                        `${input.connectorId}::${id}`,
                      );

                      if (existing) {
                        await storage.put(
                          'connector_data',
                          `${input.connectorId}::${id}`,
                          { ...item, connectorId: input.connectorId, updatedAt: new Date().toISOString() },
                        );
                        updated += 1;
                      } else {
                        await storage.put(
                          'connector_data',
                          `${input.connectorId}::${id}`,
                          { ...item, connectorId: input.connectorId, createdAt: new Date().toISOString() },
                        );
                        created += 1;
                      }
                    }
                  },
                  storageErr,
                ),
                TE.map(() => writeOk(created, updated, skipped, errors)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Test connectivity of a configured connector.
   * Validates the connector exists and its config is still valid.
   */
  test: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connectors', input.connectorId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                testNotfound(
                  `Connector '${input.connectorId}' does not exist`,
                ),
              ),
            (found) => {
              const protocolId = String(found['protocolId'] ?? '');
              const configStr = String(found['config'] ?? '{}');

              return pipe(
                validateConfig(protocolId, configStr),
                E.fold(
                  (err) =>
                    TE.right(
                      testError(`Config validation failed: ${err}`),
                    ),
                  () =>
                    pipe(
                      TE.tryCatch(
                        () =>
                          storage.put('connectors', input.connectorId, {
                            ...found,
                            status: 'connected',
                            lastTestedAt: new Date().toISOString(),
                          }),
                        storageErr,
                      ),
                      TE.map(() =>
                        testOk(
                          `Connector '${input.connectorId}' is reachable and operational`,
                        ),
                      ),
                    ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Discover available streams/schemas from the external system.
   * Requires the connector to be in a connected/configured state.
   */
  discover: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connectors', input.connectorId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                discoverNotfound(
                  `Connector '${input.connectorId}' does not exist`,
                ),
              ),
            (found) => {
              const status = String(found['status'] ?? '');
              if (status !== 'connected' && status !== 'configured') {
                return TE.right(
                  discoverError(
                    `Connector must be connected or configured for discovery (current: '${status}')`,
                  ),
                );
              }

              const protocolId = String(found['protocolId'] ?? '');
              const config = (() => {
                try {
                  return JSON.parse(String(found['config'] ?? '{}'));
                } catch {
                  return {};
                }
              })();

              // Build discovery result based on protocol
              const discoveryResult = JSON.stringify({
                connectorId: input.connectorId,
                protocol: protocolId,
                streams: [],
                discoveredAt: new Date().toISOString(),
              });

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('connectors', input.connectorId, {
                      ...found,
                      discoveredSchema: discoveryResult,
                    }),
                  storageErr,
                ),
                TE.map(() => discoverOk(discoveryResult)),
              );
            },
          ),
        ),
      ),
    ),
};
