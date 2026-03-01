// Registry concept handler — named service/concept registry with register, deregister,
// and heartbeat-based availability checks. Supports namespace separation via URI scheme.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RegistryStorage,
  RegistryRegisterInput,
  RegistryRegisterOutput,
  RegistryDeregisterInput,
  RegistryDeregisterOutput,
  RegistryHeartbeatInput,
  RegistryHeartbeatOutput,
} from './types.js';

import {
  registerOk,
  registerError,
  deregisterOk,
  heartbeatOk,
} from './types.js';

export interface RegistryError {
  readonly code: string;
  readonly message: string;
}

export interface RegistryHandler {
  readonly register: (
    input: RegistryRegisterInput,
    storage: RegistryStorage,
  ) => TE.TaskEither<RegistryError, RegistryRegisterOutput>;
  readonly deregister: (
    input: RegistryDeregisterInput,
    storage: RegistryStorage,
  ) => TE.TaskEither<RegistryError, RegistryDeregisterOutput>;
  readonly heartbeat: (
    input: RegistryHeartbeatInput,
    storage: RegistryStorage,
  ) => TE.TaskEither<RegistryError, RegistryHeartbeatOutput>;
}

// --- Pure helpers ---

const HEARTBEAT_TTL_MS = 30_000; // 30 seconds: stale after this

const parseUri = (
  uri: string,
): { readonly namespace: string; readonly name: string } | null => {
  // Expected format: "namespace/concept-name" or just "concept-name"
  const trimmed = uri.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex === -1) {
    return { namespace: 'default', name: trimmed };
  }
  const namespace = trimmed.slice(0, slashIndex);
  const name = trimmed.slice(slashIndex + 1);
  if (namespace.length === 0 || name.length === 0) {
    return null;
  }
  return { namespace, name };
};

const toStorageError = (error: unknown): RegistryError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const registryHandler: RegistryHandler = {
  register: (input, storage) => {
    const parsed = parseUri(input.uri);
    if (parsed === null) {
      return TE.right(
        registerError(`Invalid URI format: '${input.uri}'`),
      );
    }

    return pipe(
      // Check if concept is already registered at this URI
      TE.tryCatch(
        () => storage.get('registry', input.uri),
        toStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // Not registered yet, create entry
            () =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();

                  await storage.put('registry', input.uri, {
                    uri: input.uri,
                    namespace: parsed.namespace,
                    name: parsed.name,
                    transport: input.transport,
                    registeredAt: now,
                    lastHeartbeat: now,
                    available: true,
                  });

                  return registerOk(parsed.name);
                },
                toStorageError,
              ),
            // Already registered at this URI
            () =>
              TE.right(
                registerError(
                  `Concept already registered at URI '${input.uri}'`,
                ),
              ),
          ),
        ),
      ),
    );
  },

  deregister: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.delete('registry', input.uri);
          return deregisterOk();
        },
        toStorageError,
      ),
    ),

  heartbeat: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('registry', input.uri),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            // Not registered -- unavailable
            () => TE.right(heartbeatOk(false)),
            (found) => {
              const lastBeat = typeof found['lastHeartbeat'] === 'string'
                ? new Date(found['lastHeartbeat'] as string).getTime()
                : 0;
              const now = Date.now();
              const isStale = now - lastBeat > HEARTBEAT_TTL_MS;

              // Update heartbeat timestamp
              return pipe(
                TE.tryCatch(
                  async () => {
                    const updatedRecord = {
                      ...found,
                      lastHeartbeat: new Date().toISOString(),
                      available: !isStale,
                    };
                    await storage.put('registry', input.uri, updatedRecord);
                    return heartbeatOk(!isStale);
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    ),
};
