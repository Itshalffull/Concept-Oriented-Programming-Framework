// Echo concept handler — request/response echo for health checks and connectivity verification.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EchoStorage,
  EchoSendInput,
  EchoSendOutput,
} from './types.js';

import {
  sendOk,
} from './types.js';

export interface EchoError {
  readonly code: string;
  readonly message: string;
}

export interface EchoHandler {
  readonly send: (
    input: EchoSendInput,
    storage: EchoStorage,
  ) => TE.TaskEither<EchoError, EchoSendOutput>;
}

// --- Pure helpers ---

const toStorageError = (error: unknown): EchoError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const echoHandler: EchoHandler = {
  send: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const timestamp = new Date().toISOString();
          await storage.put('echo', input.id, {
            id: input.id,
            text: input.text,
            echoedAt: timestamp,
          });
          return sendOk(input.id, input.text);
        },
        toStorageError,
      ),
    ),
};
