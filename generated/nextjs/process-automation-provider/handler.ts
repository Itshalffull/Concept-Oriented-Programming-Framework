// ProcessAutomationProvider — Trigger ProcessSpec execution from automation rules.
// Starts process runs when automation fires, bridging automation into the process-foundation suite.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProcessAutomationProviderStorage,
  ProcessAutomationProviderRegisterInput,
  ProcessAutomationProviderRegisterOutput,
  ProcessAutomationProviderExecuteInput,
  ProcessAutomationProviderExecuteOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  executeOk,
  executeError,
} from './types.js';

export interface ProcessAutomationProviderError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ProcessAutomationProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ProcessAutomationProviderHandler {
  readonly register: (
    input: ProcessAutomationProviderRegisterInput,
    storage: ProcessAutomationProviderStorage,
  ) => TE.TaskEither<ProcessAutomationProviderError, ProcessAutomationProviderRegisterOutput>;
  readonly execute: (
    input: ProcessAutomationProviderExecuteInput,
    storage: ProcessAutomationProviderStorage,
  ) => TE.TaskEither<ProcessAutomationProviderError, ProcessAutomationProviderExecuteOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(): string {
  return `proc-auto-${++idCounter}`;
}

let runCounter = 0;
function nextRunId(): string {
  return `run-${++runCounter}`;
}

export const processAutomationProviderHandler: ProcessAutomationProviderHandler = {
  register: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process-automation-provider', '__registered'),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('process-automation-provider', '__registered', { value: true });
                  return registerOk('process');
                },
                toStorageError,
              ),
            () => TE.right(registerAlreadyRegistered()),
          ),
        ),
      ),
    ),

  execute: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!inp.action_payload) {
          return TE.right(executeError('action_payload is required'));
        }
        if (!inp.process_spec_id) {
          return TE.right(executeError('process_spec_id is required'));
        }

        // Validate action payload JSON
        try {
          JSON.parse(inp.action_payload);
        } catch {
          return TE.right(executeError('Invalid action_payload JSON'));
        }

        const id = nextId();
        const runId = nextRunId();
        const now = new Date().toISOString();

        return TE.tryCatch(
          async () => {
            await storage.put('process-automation-provider', id, {
              id,
              action_payload: inp.action_payload,
              process_spec_id: inp.process_spec_id,
              status: 'started',
              run_id: runId,
              error: null,
              createdAt: now,
            });
            return executeOk(runId);
          },
          toStorageError,
        );
      }),
    ),
};
