// LocalRuntime — Local dev server, file watching, and hot reload management
// Manages local development processes: provisioning with port conflict detection,
// deploying command updates, and process lifecycle management.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  LocalRuntimeStorage,
  LocalRuntimeProvisionInput,
  LocalRuntimeProvisionOutput,
  LocalRuntimeDeployInput,
  LocalRuntimeDeployOutput,
  LocalRuntimeSetTrafficWeightInput,
  LocalRuntimeSetTrafficWeightOutput,
  LocalRuntimeRollbackInput,
  LocalRuntimeRollbackOutput,
  LocalRuntimeDestroyInput,
  LocalRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionPortInUse,
  deployOk,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface LocalRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface LocalRuntimeHandler {
  readonly provision: (
    input: LocalRuntimeProvisionInput,
    storage: LocalRuntimeStorage,
  ) => TE.TaskEither<LocalRuntimeError, LocalRuntimeProvisionOutput>;
  readonly deploy: (
    input: LocalRuntimeDeployInput,
    storage: LocalRuntimeStorage,
  ) => TE.TaskEither<LocalRuntimeError, LocalRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: LocalRuntimeSetTrafficWeightInput,
    storage: LocalRuntimeStorage,
  ) => TE.TaskEither<LocalRuntimeError, LocalRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: LocalRuntimeRollbackInput,
    storage: LocalRuntimeStorage,
  ) => TE.TaskEither<LocalRuntimeError, LocalRuntimeRollbackOutput>;
  readonly destroy: (
    input: LocalRuntimeDestroyInput,
    storage: LocalRuntimeStorage,
  ) => TE.TaskEither<LocalRuntimeError, LocalRuntimeDestroyOutput>;
}

const toError = (error: unknown): LocalRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Monotonically increasing PID counter for simulated local processes
let nextPid = 1000;
const allocPid = (): number => ++nextPid;

// --- Implementation ---

export const localRuntimeHandler: LocalRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('ports', { port: input.port }),
        toError,
      ),
      TE.chain((portRecords) => {
        // Check for port conflicts with existing processes
        const existing = portRecords.find(
          (r) => Number((r as Record<string, unknown>).port) === input.port,
        );

        if (existing) {
          return TE.right<LocalRuntimeError, LocalRuntimeProvisionOutput>(
            provisionPortInUse(
              input.port,
              Number((existing as Record<string, unknown>).pid ?? 0),
            ),
          );
        }

        const processName = `local-${input.concept}`;
        const pid = allocPid();
        const endpoint = `http://localhost:${input.port}`;

        return TE.tryCatch(
          async () => {
            await storage.put('processes', processName, {
              process: processName,
              concept: input.concept,
              command: input.command,
              port: input.port,
              pid,
              endpoint,
              weight: 100,
              startedAt: new Date().toISOString(),
            });
            await storage.put('ports', String(input.port), {
              port: input.port,
              pid,
              process: processName,
            });
            return provisionOk(processName, pid, endpoint);
          },
          toError,
        );
      }),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('processes', input.process),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LocalRuntimeError, LocalRuntimeDeployOutput>({
              code: 'PROCESS_NOT_FOUND',
              message: `Process ${input.process} does not exist`,
            }),
            (existing) => {
              // Simulate restarting the process with a new command (new PID)
              const newPid = allocPid();
              return TE.tryCatch(
                async () => {
                  // Snapshot previous command for rollback
                  const previousCommand = String((existing as Record<string, unknown>).command ?? '');
                  await storage.put('commandHistory', `${input.process}:${newPid}`, {
                    process: input.process,
                    previousCommand,
                    command: input.command,
                    pid: newPid,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('processes', input.process, {
                    ...existing,
                    command: input.command,
                    pid: newPid,
                    restartedAt: new Date().toISOString(),
                  });
                  return deployOk(input.process, newPid);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('processes', input.process),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LocalRuntimeError, LocalRuntimeSetTrafficWeightOutput>({
              code: 'PROCESS_NOT_FOUND',
              message: `Process ${input.process} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('processes', input.process, {
                    ...existing,
                    weight: clampedWeight,
                  });
                  return setTrafficWeightOk(input.process);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('processes', input.process),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LocalRuntimeError, LocalRuntimeRollbackOutput>({
              code: 'PROCESS_NOT_FOUND',
              message: `Process ${input.process} does not exist`,
            }),
            (existing) => {
              // Restart with the previous command
              const newPid = allocPid();
              return TE.tryCatch(
                async () => {
                  await storage.put('processes', input.process, {
                    ...existing,
                    command: input.previousCommand,
                    pid: newPid,
                    rolledBackAt: new Date().toISOString(),
                  });
                  return rollbackOk(input.process, newPid);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('processes', input.process),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<LocalRuntimeError, LocalRuntimeDestroyOutput>({
              code: 'PROCESS_NOT_FOUND',
              message: `Process ${input.process} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Free the port binding
                  const port = String((existing as Record<string, unknown>).port ?? '');
                  await storage.delete('ports', port);
                  await storage.delete('processes', input.process);
                  return destroyOk(input.process);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
