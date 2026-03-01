// ConnectorCall — handler.ts
// Real fp-ts domain logic for idempotent connector invocation with success/failure tracking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConnectorCallStorage,
  ConnectorCallStatus,
  ConnectorCallInvokeInput,
  ConnectorCallInvokeOutput,
  ConnectorCallMarkSuccessInput,
  ConnectorCallMarkSuccessOutput,
  ConnectorCallMarkFailureInput,
  ConnectorCallMarkFailureOutput,
  ConnectorCallGetResultInput,
  ConnectorCallGetResultOutput,
} from './types.js';

import {
  invokeOk,
  invokeDuplicate,
  markSuccessOk,
  markSuccessNotFound,
  markSuccessInvalidStatus,
  markFailureOk,
  markFailureNotFound,
  markFailureInvalidStatus,
  getResultOk,
  getResultNotFound,
} from './types.js';

export interface ConnectorCallError {
  readonly code: string;
  readonly message: string;
}

export interface ConnectorCallHandler {
  readonly invoke: (
    input: ConnectorCallInvokeInput,
    storage: ConnectorCallStorage,
  ) => TE.TaskEither<ConnectorCallError, ConnectorCallInvokeOutput>;
  readonly mark_success: (
    input: ConnectorCallMarkSuccessInput,
    storage: ConnectorCallStorage,
  ) => TE.TaskEither<ConnectorCallError, ConnectorCallMarkSuccessOutput>;
  readonly mark_failure: (
    input: ConnectorCallMarkFailureInput,
    storage: ConnectorCallStorage,
  ) => TE.TaskEither<ConnectorCallError, ConnectorCallMarkFailureOutput>;
  readonly get_result: (
    input: ConnectorCallGetResultInput,
    storage: ConnectorCallStorage,
  ) => TE.TaskEither<ConnectorCallError, ConnectorCallGetResultOutput>;
}

// --- Pure helpers ---

const compositeKey = (run_ref: string, step_ref: string): string =>
  `${run_ref}::${step_ref}`;

const storageError = (error: unknown): ConnectorCallError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const connectorCallHandler: ConnectorCallHandler = {
  /**
   * Invoke a connector call. Uses the idempotency_key to prevent duplicate
   * invocations. If a call with the same idempotency key already exists,
   * returns a duplicate variant instead of creating a new record.
   */
  invoke: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('idempotency_keys', input.idempotency_key),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => {
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  const now = Date.now();
                  // Store the call record
                  await storage.put('connector_calls', key, {
                    call_id: key,
                    run_ref: input.run_ref,
                    step_ref: input.step_ref,
                    connector_id: input.connector_id,
                    idempotency_key: input.idempotency_key,
                    request_payload: input.request_payload,
                    timeout_ms: input.timeout_ms ?? 30000,
                    status: 'invoking' as ConnectorCallStatus,
                    response_payload: null,
                    error_code: null,
                    error_message: null,
                    created_at: now,
                    updated_at: now,
                  });
                  // Record the idempotency key mapping
                  await storage.put('idempotency_keys', input.idempotency_key, {
                    call_id: key,
                    idempotency_key: input.idempotency_key,
                    created_at: now,
                  });
                  return invokeOk(key, 'invoking', input.idempotency_key);
                },
                storageError,
              );
            },
            (existingRecord) => {
              const existingCallId = existingRecord.call_id as string;
              return pipe(
                TE.tryCatch(
                  () => storage.get('connector_calls', existingCallId),
                  storageError,
                ),
                TE.map((callRecord) => {
                  const existingStatus = (callRecord?.status as ConnectorCallStatus) ?? 'pending';
                  return invokeDuplicate(
                    existingCallId,
                    existingStatus,
                    `Duplicate idempotency key '${input.idempotency_key}' — call already exists`,
                  );
                }),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Mark a connector call as succeeded. Records the response payload and code.
   * Only allowed from invoking status.
   */
  mark_success: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector_calls', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ConnectorCallError, ConnectorCallMarkSuccessOutput>(
              markSuccessNotFound(`Connector call '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (call) => {
              const status = call.status as ConnectorCallStatus;
              if (status !== 'invoking') {
                return TE.right<ConnectorCallError, ConnectorCallMarkSuccessOutput>(
                  markSuccessInvalidStatus(
                    `Connector call must be in 'invoking' status, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  await storage.put('connector_calls', key, {
                    ...call,
                    status: 'succeeded' as ConnectorCallStatus,
                    response_payload: input.response_payload,
                    response_code: input.response_code,
                    completed_at: Date.now(),
                    updated_at: Date.now(),
                  });
                  return markSuccessOk(key, 'succeeded', input.response_code);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Mark a connector call as failed. Records the error code and message.
   * Only allowed from invoking status.
   */
  mark_failure: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector_calls', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ConnectorCallError, ConnectorCallMarkFailureOutput>(
              markFailureNotFound(`Connector call '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (call) => {
              const status = call.status as ConnectorCallStatus;
              if (status !== 'invoking') {
                return TE.right<ConnectorCallError, ConnectorCallMarkFailureOutput>(
                  markFailureInvalidStatus(
                    `Connector call must be in 'invoking' status, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  await storage.put('connector_calls', key, {
                    ...call,
                    status: 'failed' as ConnectorCallStatus,
                    error_code: input.error_code,
                    error_message: input.error_message,
                    completed_at: Date.now(),
                    updated_at: Date.now(),
                  });
                  return markFailureOk(key, 'failed', input.error_code);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Get the current result of a connector call including status, response, and errors.
   */
  get_result: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector_calls', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ConnectorCallError, ConnectorCallGetResultOutput>(
              getResultNotFound(`Connector call '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (call) =>
              TE.right<ConnectorCallError, ConnectorCallGetResultOutput>(
                getResultOk(
                  call.call_id as string,
                  call.status as ConnectorCallStatus,
                  (call.response_payload as Record<string, unknown>) ?? null,
                  (call.error_code as string) ?? null,
                  (call.error_message as string) ?? null,
                ),
              ),
          ),
        ),
      ),
    ),
};
