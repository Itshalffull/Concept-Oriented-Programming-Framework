// DevServer — Dev server start/stop, port config, middleware stack, and HMR
// Manages local development server sessions: starting with port validation,
// stopping sessions, and querying runtime status with uptime tracking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DevServerStorage,
  DevServerStartInput,
  DevServerStartOutput,
  DevServerStopInput,
  DevServerStopOutput,
  DevServerStatusInput,
  DevServerStatusOutput,
} from './types.js';

import {
  startOk,
  startPortInUse,
  stopOk,
  statusRunning,
  statusStopped,
} from './types.js';

export interface DevServerError {
  readonly code: string;
  readonly message: string;
}

export interface DevServerHandler {
  readonly start: (
    input: DevServerStartInput,
    storage: DevServerStorage,
  ) => TE.TaskEither<DevServerError, DevServerStartOutput>;
  readonly stop: (
    input: DevServerStopInput,
    storage: DevServerStorage,
  ) => TE.TaskEither<DevServerError, DevServerStopOutput>;
  readonly status: (
    input: DevServerStatusInput,
    storage: DevServerStorage,
  ) => TE.TaskEither<DevServerError, DevServerStatusOutput>;
}

const toError = (error: unknown): DevServerError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const devServerHandler: DevServerHandler = {
  start: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('dev-ports', { port: input.port }),
        toError,
      ),
      TE.chain((existing) => {
        // Check if the requested port is already bound to another session
        if (existing.length > 0) {
          return TE.right<DevServerError, DevServerStartOutput>(
            startPortInUse(input.port),
          );
        }

        const session = `dev-${input.port}-${Date.now().toString(36)}`;
        const url = `http://localhost:${input.port}`;

        return TE.tryCatch(
          async () => {
            await storage.put('dev-sessions', session, {
              session,
              port: input.port,
              url,
              watchDirs: input.watchDirs,
              status: 'running',
              startedAt: new Date().toISOString(),
              lastRecompile: new Date().toISOString(),
            });
            await storage.put('dev-ports', String(input.port), {
              port: input.port,
              session,
            });
            return startOk(session, input.port, url);
          },
          toError,
        );
      }),
    ),

  stop: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('dev-sessions', input.session),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<DevServerError, DevServerStopOutput>({
              code: 'SESSION_NOT_FOUND',
              message: `Dev server session ${input.session} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Free the port binding
                  const port = String((existing as Record<string, unknown>).port ?? '');
                  await storage.delete('dev-ports', port);
                  await storage.put('dev-sessions', input.session, {
                    ...existing,
                    status: 'stopped',
                    stoppedAt: new Date().toISOString(),
                  });
                  return stopOk(input.session);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('dev-sessions', input.session),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<DevServerError, DevServerStatusOutput>(statusStopped()),
            (existing) => {
              const status = String((existing as Record<string, unknown>).status ?? 'stopped');

              if (status !== 'running') {
                return TE.right<DevServerError, DevServerStatusOutput>(statusStopped());
              }

              const port = Number((existing as Record<string, unknown>).port ?? 0);
              const startedAt = String((existing as Record<string, unknown>).startedAt ?? new Date().toISOString());
              const uptime = Date.now() - new Date(startedAt).getTime();
              const lastRecompile = String((existing as Record<string, unknown>).lastRecompile ?? new Date().toISOString());

              return TE.right<DevServerError, DevServerStatusOutput>(
                statusRunning(port, uptime, lastRecompile),
              );
            },
          ),
        ),
      ),
    ),
};
