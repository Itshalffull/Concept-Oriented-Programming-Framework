// LLMCall — Manages LLM invocation lifecycle with schema validation and repair loops.
// Tracks call status through requesting, validating, and terminal states (accepted/rejected).
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  LLMCallStorage,
  LLMCallRequestInput,
  LLMCallRequestOutput,
  LLMCallRecordResponseInput,
  LLMCallRecordResponseOutput,
  LLMCallValidateInput,
  LLMCallValidateOutput,
  LLMCallRepairInput,
  LLMCallRepairOutput,
  LLMCallAcceptInput,
  LLMCallAcceptOutput,
  LLMCallRejectInput,
  LLMCallRejectOutput,
} from './types.js';

import {
  requestOk,
  recordResponseOk,
  recordResponseNotfound,
  recordResponseInvalidStatus,
  validateValid,
  validateInvalid,
  validateNotfound,
  validateInvalidStatus,
  repairOk,
  repairMaxAttemptsReached,
  repairNotfound,
  repairInvalidStatus,
  acceptOk,
  acceptNotfound,
  acceptInvalidStatus,
  rejectOk,
  rejectNotfound,
  rejectInvalidStatus,
} from './types.js';

export interface LLMCallError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): LLMCallError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface LLMCallHandler {
  readonly request: (
    input: LLMCallRequestInput,
    storage: LLMCallStorage,
  ) => TE.TaskEither<LLMCallError, LLMCallRequestOutput>;
  readonly recordResponse: (
    input: LLMCallRecordResponseInput,
    storage: LLMCallStorage,
  ) => TE.TaskEither<LLMCallError, LLMCallRecordResponseOutput>;
  readonly validate: (
    input: LLMCallValidateInput,
    storage: LLMCallStorage,
  ) => TE.TaskEither<LLMCallError, LLMCallValidateOutput>;
  readonly repair: (
    input: LLMCallRepairInput,
    storage: LLMCallStorage,
  ) => TE.TaskEither<LLMCallError, LLMCallRepairOutput>;
  readonly accept: (
    input: LLMCallAcceptInput,
    storage: LLMCallStorage,
  ) => TE.TaskEither<LLMCallError, LLMCallAcceptOutput>;
  readonly reject: (
    input: LLMCallRejectInput,
    storage: LLMCallStorage,
  ) => TE.TaskEither<LLMCallError, LLMCallRejectOutput>;
}

// --- Implementation ---

export const llmCallHandler: LLMCallHandler = {
  request: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          await storage.put('llm_call', input.call_id, {
            call_id: input.call_id,
            step_ref: input.step_ref,
            model: input.model,
            prompt: input.prompt,
            output_schema: input.output_schema ?? null,
            max_attempts: input.max_attempts,
            attempt_count: 1,
            status: 'requesting',
            raw_output: null,
            prompt_tokens: 0,
            completion_tokens: 0,
            createdAt: now,
            updatedAt: now,
          });
          return requestOk(input.call_id);
        },
        toStorageError,
      ),
    ),

  recordResponse: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('llm_call', input.call_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                recordResponseNotfound(`LLM call '${input.call_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'requesting') {
                return TE.right(
                  recordResponseInvalidStatus(
                    `Cannot record response: call is in '${status}' status, expected 'requesting'`,
                  ),
                );
              }
              const hasSchema = existing['output_schema'] !== null && existing['output_schema'] !== undefined;
              const nextStatus = hasSchema ? 'validating' : 'requesting';
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('llm_call', input.call_id, {
                    ...existing,
                    raw_output: input.raw_output,
                    prompt_tokens: input.prompt_tokens,
                    completion_tokens: input.completion_tokens,
                    status: nextStatus,
                    updatedAt: now,
                  });
                  return recordResponseOk(input.call_id, nextStatus);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('llm_call', input.call_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                validateNotfound(`LLM call '${input.call_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'validating') {
                return TE.right(
                  validateInvalidStatus(
                    `Cannot validate: call is in '${status}' status, expected 'validating'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const rawOutput = String(existing['raw_output'] ?? '');
                  const schemaStr = String(existing['output_schema'] ?? '{}');
                  // Attempt to parse raw_output as JSON and validate against schema keys
                  try {
                    const parsed = JSON.parse(rawOutput);
                    const schema = JSON.parse(schemaStr);
                    const schemaKeys = Object.keys(schema);
                    const missingKeys = schemaKeys.filter((k) => !(k in parsed));
                    if (missingKeys.length > 0) {
                      const now = new Date().toISOString();
                      await storage.put('llm_call', input.call_id, {
                        ...existing,
                        status: 'repairing',
                        updatedAt: now,
                      });
                      return validateInvalid(
                        input.call_id,
                        JSON.stringify(missingKeys.map((k) => `Missing required key: ${k}`)),
                      );
                    }
                    const now = new Date().toISOString();
                    await storage.put('llm_call', input.call_id, {
                      ...existing,
                      status: 'accepted',
                      updatedAt: now,
                    });
                    return validateValid(input.call_id, rawOutput);
                  } catch {
                    const now = new Date().toISOString();
                    await storage.put('llm_call', input.call_id, {
                      ...existing,
                      status: 'repairing',
                      updatedAt: now,
                    });
                    return validateInvalid(
                      input.call_id,
                      JSON.stringify(['Output is not valid JSON']),
                    );
                  }
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  repair: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('llm_call', input.call_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                repairNotfound(`LLM call '${input.call_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'repairing') {
                return TE.right(
                  repairInvalidStatus(
                    `Cannot repair: call is in '${status}' status, expected 'repairing'`,
                  ),
                );
              }
              const attemptCount = Number(existing['attempt_count'] ?? 1);
              const maxAttempts = Number(existing['max_attempts'] ?? 1);
              if (attemptCount >= maxAttempts) {
                return TE.tryCatch(
                  async () => {
                    const now = new Date().toISOString();
                    await storage.put('llm_call', input.call_id, {
                      ...existing,
                      status: 'rejected',
                      updatedAt: now,
                    });
                    return repairMaxAttemptsReached(input.call_id, attemptCount);
                  },
                  toStorageError,
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const newAttempt = attemptCount + 1;
                  await storage.put('llm_call', input.call_id, {
                    ...existing,
                    attempt_count: newAttempt,
                    status: 'requesting',
                    raw_output: null,
                    updatedAt: now,
                  });
                  return repairOk(input.call_id, newAttempt);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  accept: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('llm_call', input.call_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                acceptNotfound(`LLM call '${input.call_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              const acceptableStatuses = ['requesting', 'validating', 'repairing'];
              if (!acceptableStatuses.includes(status)) {
                return TE.right(
                  acceptInvalidStatus(
                    `Cannot accept: call is in '${status}' status, expected one of ${acceptableStatuses.join(', ')}`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('llm_call', input.call_id, {
                    ...existing,
                    status: 'accepted',
                    updatedAt: now,
                  });
                  return acceptOk(input.call_id);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  reject: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('llm_call', input.call_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                rejectNotfound(`LLM call '${input.call_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              const terminalStatuses = ['accepted', 'rejected'];
              if (terminalStatuses.includes(status)) {
                return TE.right(
                  rejectInvalidStatus(
                    `Cannot reject: call is already in terminal status '${status}'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('llm_call', input.call_id, {
                    ...existing,
                    status: 'rejected',
                    updatedAt: now,
                  });
                  return rejectOk(input.call_id);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),
};
