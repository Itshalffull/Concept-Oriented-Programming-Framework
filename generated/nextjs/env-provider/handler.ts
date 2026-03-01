// EnvProvider — Environment variable provider.
// Reads environment variables from the runtime process environment,
// validates their presence, and returns their values through a typed
// TaskEither pipeline. Uses storage for caching and audit logging.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EnvProviderStorage,
  EnvProviderFetchInput,
  EnvProviderFetchOutput,
} from './types.js';

import {
  fetchOk,
  fetchVariableNotSet,
} from './types.js';

export interface EnvProviderError {
  readonly code: string;
  readonly message: string;
}

export interface EnvProviderHandler {
  readonly fetch: (
    input: EnvProviderFetchInput,
    storage: EnvProviderStorage,
  ) => TE.TaskEither<EnvProviderError, EnvProviderFetchOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): EnvProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Validate that a variable name conforms to POSIX conventions. */
const isValidEnvName = (name: string): boolean =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

// --- Implementation ---

export const envProviderHandler: EnvProviderHandler = {
  fetch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name } = input;

          // First check storage for a cached / overridden value
          const cached = await storage.get('env_cache', name);

          const cachedValue = pipe(
            O.fromNullable(cached),
            O.chain((r) => O.fromNullable(r['value'] as string | undefined)),
          );

          // If we have a cached value, return it immediately
          if (O.isSome(cachedValue)) {
            return fetchOk(cachedValue.value);
          }

          // Fall back to the process environment
          const envValue = pipe(
            O.fromNullable(
              typeof process !== 'undefined' ? process.env[name] : undefined,
            ),
          );

          return pipe(
            envValue,
            O.fold(
              // Variable is not set in the environment
              () => fetchVariableNotSet(name),
              (value) => {
                // Cache the value in storage for subsequent lookups
                // Fire-and-forget; we do not block on the cache write
                storage.put('env_cache', name, {
                  name,
                  value,
                  source: 'process.env',
                  cachedAt: new Date().toISOString(),
                }).catch(() => {
                  // Swallow cache write errors; reading is the primary operation
                });
                return fetchOk(value);
              },
            ),
          );
        },
        storageError,
      ),
    ),
};
