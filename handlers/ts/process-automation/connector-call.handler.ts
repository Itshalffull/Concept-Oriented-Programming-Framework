// @clef-handler style=functional
// ConnectorCall Concept Implementation
// Track outbound calls to external systems with idempotency keys and status lifecycle.
// Actual I/O is delegated to providers via syncs.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _connectorCallHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ConnectorCall' }) as StorageProgram<Result>;
  },

  invoke(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const connectorType = input.connector_type as string;
    const operation = input.operation as string;
    const inputData = input.input as string;
    const idempotencyKey = input.idempotency_key as string;

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }

    // Check for duplicate idempotency key
    let p = createProgram();
    p = find(p, 'call', { idempotency_key: idempotencyKey }, 'existing');
    p = mapBindings(p, (bindings) => {
      const existing = (bindings.existing as Array<Record<string, unknown>>) || [];
      return existing.length > 0 ? existing[0] : null;
    }, 'duplicate');

    return branch(p,
      (bindings) => bindings.duplicate != null,
      (() => {
        const d = createProgram();
        return complete(d, 'duplicate', { idempotency_key: idempotencyKey });
      })(),
      (() => {
        const callId = `call-${idempotencyKey}`;
        const now = new Date().toISOString();
        let b = createProgram();
        b = put(b, 'call', callId, {
          call: callId,
          step_ref: stepRef,
          connector_type: connectorType,
          operation,
          input: inputData,
          output: null,
          status: 'invoking',
          idempotency_key: idempotencyKey,
          error: null,
          invoked_at: now,
          completed_at: null,
        });
        return complete(b, 'ok', { call: callId, step_ref: stepRef });
      })(),
    ) as StorageProgram<Result>;
  },

  mark_success(input: Record<string, unknown>) {
    const call = input.call as string;
    const output = input.output as string;

    let p = createProgram();
    p = spGet(p, 'call', call, 'existing');

    return branch(p,
      (bindings) => {
        const rec = bindings.existing as Record<string, unknown> | null;
        return rec != null && rec.status === 'invoking';
      },
      (() => {
        const now = new Date().toISOString();
        let b = createProgram();
        b = putFrom(b, 'call', call, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            status: 'succeeded',
            output,
            completed_at: now,
          };
        });
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { call, step_ref: rec.step_ref as string, output };
        });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { call });
      })(),
    ) as StorageProgram<Result>;
  },

  mark_failure(input: Record<string, unknown>) {
    const call = input.call as string;
    const error = input.error as string;

    if (!error || error.trim() === '') {
      return complete(createProgram(), 'error', { message: 'error is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'call', call, 'existing');

    return branch(p,
      (bindings) => {
        const rec = bindings.existing as Record<string, unknown> | null;
        return rec != null && rec.status === 'invoking';
      },
      (() => {
        const now = new Date().toISOString();
        let b = createProgram();
        b = putFrom(b, 'call', call, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            status: 'failed',
            error,
            completed_at: now,
          };
        });
        return completeFrom(b, 'error', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { call, step_ref: rec.step_ref as string, message: error };
        });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { call });
      })(),
    ) as StorageProgram<Result>;
  },

  get_result(input: Record<string, unknown>) {
    const call = input.call as string;

    let p = createProgram();
    p = spGet(p, 'call', call, 'existing');

    return branch(p,
      (bindings) => bindings.existing != null,
      (() => {
        const b = createProgram();
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            call,
            status: rec.status as string,
            output: (rec.output as string) || '',
          };
        });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'not_found', { call });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const connectorCallHandler = autoInterpret(_connectorCallHandler);
