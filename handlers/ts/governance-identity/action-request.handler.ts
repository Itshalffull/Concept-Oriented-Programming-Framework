// @clef-handler style=functional
// ActionRequest Concept Implementation
// Capture a subject's request to perform a specific action that requires
// explicit approval before execution. Supervised per-action approval flows
// that were formerly part of AgenticDelegate now live here.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `action-request-${++idCounter}`;
}

/** Safely extract a string id from an input field that may be a ref placeholder object */
function extractId(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  // ref placeholder objects like {"type":"ref","fixture":"...","field":"..."}
  // are passed by the test generator for structural tests — treat as empty
  return '';
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ActionRequest' }) as StorageProgram<Result>;
  },

  request(input: Record<string, unknown>) {
    const subjectId = (input.subjectId as string) ?? '';
    const conceptName = (input.conceptName as string) ?? '';
    const actionName = (input.actionName as string) ?? '';
    const actionInput = (input.actionInput as string) ?? '';

    if (!subjectId || subjectId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'subjectId is required' }) as StorageProgram<Result>;
    }
    if (!conceptName || conceptName.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'conceptName is required' }) as StorageProgram<Result>;
    }
    if (!actionName || actionName.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'actionName is required' }) as StorageProgram<Result>;
    }

    // Validate actionInput is parseable JSON
    try {
      JSON.parse(actionInput || '{}');
    } catch {
      return complete(createProgram(), 'invalid', { message: 'actionInput must be valid JSON' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'action-request', id, {
      id,
      subjectId: subjectId.trim(),
      conceptName: conceptName.trim(),
      actionName: actionName.trim(),
      actionInput,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      reviewerId: null,
      reviewNote: null,
      executionResult: null,
    });

    return complete(p, 'ok', { request: id }) as StorageProgram<Result>;
  },

  approve(input: Record<string, unknown>) {
    const requestId = extractId(input.request);
    const reviewerId = (input.reviewerId as string) ?? '';
    const reviewNote = (input.reviewNote as string | null | undefined) ?? null;

    if (!requestId || requestId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'request id is required' }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'action-request', requestId, 'existing');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'No request exists with this identifier' }),
      (() => {
        let b = createProgram();
        b = get(b, 'action-request', requestId, 'existing');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown> | null;
          return rec ? (rec.status as string) : null;
        }, '_status');
        return branch(b,
          (bindings) => (bindings._status as string) !== 'pending',
          completeFrom(createProgram(), 'invalid', (bindings) => ({
            message: `Request is in status "${bindings._status}" and cannot be approved`,
          })),
          (() => {
            let c = createProgram();
            c = get(c, 'action-request', requestId, 'existing');
            c = putFrom(c, 'action-request', requestId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, status: 'approved', reviewerId, reviewNote, updatedAt: now };
            });
            return complete(c, 'ok', { request: requestId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  reject(input: Record<string, unknown>) {
    const requestId = extractId(input.request);
    const reviewerId = (input.reviewerId as string) ?? '';
    const reviewNote = (input.reviewNote as string) ?? '';

    if (!requestId || requestId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'request id is required' }) as StorageProgram<Result>;
    }
    if (!reviewNote || reviewNote.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'reviewNote is required for rejection' }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'action-request', requestId, 'existing');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'No request exists with this identifier' }),
      (() => {
        let b = createProgram();
        b = get(b, 'action-request', requestId, 'existing');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown> | null;
          return rec ? (rec.status as string) : null;
        }, '_status');
        return branch(b,
          (bindings) => (bindings._status as string) !== 'pending',
          completeFrom(createProgram(), 'invalid', (bindings) => ({
            message: `Request is in status "${bindings._status}" and cannot be rejected`,
          })),
          (() => {
            let c = createProgram();
            c = get(c, 'action-request', requestId, 'existing');
            c = putFrom(c, 'action-request', requestId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, status: 'rejected', reviewerId, reviewNote, updatedAt: now };
            });
            return complete(c, 'ok', { request: requestId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const requestId = extractId(input.request);

    if (!requestId || requestId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'request id is required' }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();
    const executionResult = JSON.stringify({ executedAt: now });

    let p = createProgram();
    p = get(p, 'action-request', requestId, 'existing');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'No request exists with this identifier' }),
      (() => {
        let b = createProgram();
        b = get(b, 'action-request', requestId, 'existing');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown> | null;
          return rec ? (rec.status as string) : null;
        }, '_status');
        return branch(b,
          (bindings) => (bindings._status as string) !== 'approved',
          completeFrom(createProgram(), 'invalid', (bindings) => ({
            message: `Request is in status "${bindings._status}" and cannot be executed`,
          })),
          (() => {
            let c = createProgram();
            c = get(c, 'action-request', requestId, 'existing');
            c = putFrom(c, 'action-request', requestId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return { ...rec, status: 'executed', executionResult, updatedAt: now };
            });
            return complete(c, 'ok', { request: requestId, executionResult });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const requestId = extractId(input.request);

    let p = createProgram();
    p = get(p, 'action-request', requestId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'No request exists with this identifier' }),
      (() => {
        let b = createProgram();
        b = get(b, 'action-request', requestId, 'existing');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            subjectId: rec.subjectId as string,
            conceptName: rec.conceptName as string,
            actionName: rec.actionName as string,
            actionInput: rec.actionInput as string,
            status: rec.status as string,
            createdAt: rec.createdAt as string,
            updatedAt: rec.updatedAt as string,
            reviewerId: (rec.reviewerId as string | null) ?? null,
            reviewNote: (rec.reviewNote as string | null) ?? null,
            executionResult: (rec.executionResult as string | null) ?? null,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const actionRequestHandler = autoInterpret(_handler);

/** Reset internal id counter. Useful for testing. */
export function resetActionRequest(): void {
  idCounter = 0;
}
