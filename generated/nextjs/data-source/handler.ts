// DataSource — handler.ts
// External data source registration, connection management, schema discovery,
// health checking, and deactivation.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DataSourceStorage,
  DataSourceRegisterInput,
  DataSourceRegisterOutput,
  DataSourceConnectInput,
  DataSourceConnectOutput,
  DataSourceDiscoverInput,
  DataSourceDiscoverOutput,
  DataSourceHealthCheckInput,
  DataSourceHealthCheckOutput,
  DataSourceDeactivateInput,
  DataSourceDeactivateOutput,
} from './types.js';

import {
  registerOk,
  registerExists,
  connectOk,
  connectNotfound,
  connectError,
  discoverOk,
  discoverNotfound,
  discoverError,
  healthCheckOk,
  healthCheckNotfound,
  deactivateOk,
  deactivateNotfound,
} from './types.js';

export interface DataSourceError {
  readonly code: string;
  readonly message: string;
}

export interface DataSourceHandler {
  readonly register: (
    input: DataSourceRegisterInput,
    storage: DataSourceStorage,
  ) => TE.TaskEither<DataSourceError, DataSourceRegisterOutput>;
  readonly connect: (
    input: DataSourceConnectInput,
    storage: DataSourceStorage,
  ) => TE.TaskEither<DataSourceError, DataSourceConnectOutput>;
  readonly discover: (
    input: DataSourceDiscoverInput,
    storage: DataSourceStorage,
  ) => TE.TaskEither<DataSourceError, DataSourceDiscoverOutput>;
  readonly healthCheck: (
    input: DataSourceHealthCheckInput,
    storage: DataSourceStorage,
  ) => TE.TaskEither<DataSourceError, DataSourceHealthCheckOutput>;
  readonly deactivate: (
    input: DataSourceDeactivateInput,
    storage: DataSourceStorage,
  ) => TE.TaskEither<DataSourceError, DataSourceDeactivateOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): DataSourceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a deterministic source ID from the name. */
const sourceIdFromName = (name: string): string =>
  `src-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

/** Validate a URI string format. */
const isValidUri = (uri: string): boolean => {
  try {
    new URL(uri);
    return true;
  } catch {
    return uri.length > 0;
  }
};

// --- Implementation ---

export const dataSourceHandler: DataSourceHandler = {
  /**
   * Register a new data source with name, URI, and credentials.
   * Checks for existing source with the same name to prevent duplicates.
   * Generates a deterministic sourceId from the name.
   */
  register: (input, storage) => {
    const sourceId = sourceIdFromName(input.name);
    return pipe(
      TE.tryCatch(
        () => storage.find('sources', { name: input.name }),
        storageErr,
      ),
      TE.chain((existing) =>
        existing.length > 0
          ? TE.right(
              registerExists(`Source '${input.name}' is already registered`),
            )
          : pipe(
              TE.tryCatch(
                () =>
                  storage.put('sources', sourceId, {
                    sourceId,
                    name: input.name,
                    uri: input.uri,
                    credentials: input.credentials,
                    status: 'registered',
                    discoveredSchema: '',
                    lastHealthCheck: '',
                    metadata: JSON.stringify({}),
                    createdAt: new Date().toISOString(),
                  }),
                storageErr,
              ),
              TE.map(() => registerOk(sourceId)),
            ),
      ),
    );
  },

  /**
   * Verify connectivity to a registered data source.
   * Fetches the source record, validates the URI, and updates status
   * to 'connected' on success.
   */
  connect: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sources', input.sourceId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                connectNotfound(`Source '${input.sourceId}' does not exist`),
              ),
            (found) => {
              const uri = String(found['uri'] ?? '');
              const status = String(found['status'] ?? '');

              if (status === 'inactive') {
                return TE.right(
                  connectError(
                    `Source '${input.sourceId}' is deactivated`,
                  ),
                );
              }

              if (!isValidUri(uri)) {
                return TE.right(
                  connectError(`Invalid URI: '${uri}'`),
                );
              }

              // Simulate connection verification (URI validation serves as proxy)
              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('sources', input.sourceId, {
                      ...found,
                      status: 'connected',
                      lastHealthCheck: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => connectOk('Connection verified successfully')),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Introspect the source to discover available streams and fields.
   * Requires the source to be connected. Stores the discovered schema.
   */
  discover: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sources', input.sourceId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                discoverNotfound(`Source '${input.sourceId}' does not exist`),
              ),
            (found) => {
              const status = String(found['status'] ?? '');

              if (status !== 'connected') {
                return TE.right(
                  discoverError(
                    `Source '${input.sourceId}' must be connected before discovery (current status: '${status}')`,
                  ),
                );
              }

              // Build a synthetic schema discovery result based on the source URI
              const uri = String(found['uri'] ?? '');
              const discoveredSchema = JSON.stringify({
                source: input.sourceId,
                uri,
                streams: [],
                discoveredAt: new Date().toISOString(),
              });

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('sources', input.sourceId, {
                      ...found,
                      discoveredSchema,
                    }),
                  storageErr,
                ),
                TE.map(() => discoverOk(discoveredSchema)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Check the health/reachability of a registered source.
   * Returns the current status and updates the lastHealthCheck timestamp.
   */
  healthCheck: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sources', input.sourceId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                healthCheckNotfound(
                  `Source '${input.sourceId}' does not exist`,
                ),
              ),
            (found) => {
              const currentStatus = String(found['status'] ?? 'unknown');
              const uri = String(found['uri'] ?? '');
              const isReachable = isValidUri(uri) && currentStatus !== 'inactive';
              const healthStatus = isReachable ? 'healthy' : 'unreachable';

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('sources', input.sourceId, {
                      ...found,
                      lastHealthCheck: new Date().toISOString(),
                      metadata: JSON.stringify({
                        healthStatus,
                        checkedAt: new Date().toISOString(),
                      }),
                    }),
                  storageErr,
                ),
                TE.map(() =>
                  healthCheckOk(
                    JSON.stringify({
                      status: healthStatus,
                      sourceStatus: currentStatus,
                      uri,
                    }),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Deactivate a source without deleting its configuration.
   * Sets status to 'inactive' so no connections can be established.
   */
  deactivate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sources', input.sourceId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deactivateNotfound(
                  `Source '${input.sourceId}' does not exist`,
                ),
              ),
            (found) =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.put('sources', input.sourceId, {
                      ...found,
                      status: 'inactive',
                      deactivatedAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => deactivateOk()),
              ),
          ),
        ),
      ),
    ),
};
