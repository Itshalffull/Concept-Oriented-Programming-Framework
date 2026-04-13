// @clef-handler style=functional concept=Invocation export=invocationHandler
// Invocation handler — functional StorageProgram style
// Tracks the observable lifecycle of every ActionBinding/invoke call.
// Each invocation is stored as a record keyed by its opaque id.
// Status is derived from timestamps and outcome fields:
//   pending  → completedAt is null
//   ok       → completedAt set, error is null
//   error    → completedAt set, error present
// Dismissed invocations retain their record until GC'd by the host.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, find, traverse,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

interface InvocationRecord {
  connection: string;
  binding: string;
  params: string;      // base64 Bytes on wire
  startedAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
  result: string | null;
  error: string | null;
  retriedFrom: string | null;
}

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'Invocation' });
  },

  // ---------------------------------------------------------------------------
  // start — register a new pending invocation
  // ---------------------------------------------------------------------------
  start(input: Record<string, unknown>) {
    const invocation = String(input.invocation ?? '');
    const connection = String(input.connection ?? '');
    const binding = String(input.binding ?? '');
    const params = String(input.params ?? '');
    const startedAt = String(input.startedAt ?? '');

    if (!invocation.trim()) {
      return complete(createProgram(), 'error', { message: 'invocation id is required' });
    }
    if (!binding.trim()) {
      return complete(createProgram(), 'error', { message: 'binding id is required' });
    }
    if (!connection.trim()) {
      return complete(createProgram(), 'error', { message: 'connection id is required' });
    }

    let p = createProgram();
    p = get(p, 'invocations', invocation, 'existing');
    return branch(p,
      (bindings) => bindings.existing != null,
      (b) => complete(b, 'duplicate', { invocation }),
      (b) => {
        const record: InvocationRecord = {
          connection,
          binding,
          params,
          startedAt,
          completedAt: null,
          dismissedAt: null,
          result: null,
          error: null,
          retriedFrom: null,
        };
        const p2 = put(b, 'invocations', invocation, record);
        return complete(p2, 'ok', { invocation });
      },
    );
  },

  // ---------------------------------------------------------------------------
  // complete — record a successful outcome
  // ---------------------------------------------------------------------------
  complete(input: Record<string, unknown>) {
    const invocation = String(input.invocation ?? '');
    const result = String(input.result ?? '');
    const completedAt = String(input.completedAt ?? '');

    let p = createProgram();
    p = get(p, 'invocations', invocation, 'existing');

    return branch(p,
      (bindings) => bindings.existing == null,
      (b) => complete(b, 'not_found', { message: `no invocation with id '${invocation}'` }),
      (b) => {
        // Extract whether the invocation is already completed into a binding
        const p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as InvocationRecord;
          return rec.completedAt != null;
        }, '_alreadyCompleted');

        return branch(p2,
          (bindings) => bindings._alreadyCompleted as boolean,
          (b2) => complete(b2, 'already_completed', {
            message: `invocation '${invocation}' already completed`,
          }),
          (b2) => {
            const p3 = putFrom(b2, 'invocations', invocation, (bindings) => {
              const existing = bindings.existing as InvocationRecord;
              return { ...existing, result, completedAt };
            });
            return complete(p3, 'ok', { invocation });
          },
        );
      },
    );
  },

  // ---------------------------------------------------------------------------
  // fail — record a failed outcome
  // ---------------------------------------------------------------------------
  fail(input: Record<string, unknown>) {
    const invocation = String(input.invocation ?? '');
    const error = String(input.error ?? '');
    const completedAt = String(input.completedAt ?? '');

    let p = createProgram();
    p = get(p, 'invocations', invocation, 'existing');

    return branch(p,
      (bindings) => bindings.existing == null,
      (b) => complete(b, 'not_found', { message: `no invocation with id '${invocation}'` }),
      (b) => {
        const p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as InvocationRecord;
          return rec.completedAt != null;
        }, '_alreadyCompleted');

        return branch(p2,
          (bindings) => bindings._alreadyCompleted as boolean,
          (b2) => complete(b2, 'already_completed', {
            message: `invocation '${invocation}' already completed`,
          }),
          (b2) => {
            const p3 = putFrom(b2, 'invocations', invocation, (bindings) => {
              const existing = bindings.existing as InvocationRecord;
              return { ...existing, error, completedAt };
            });
            return complete(p3, 'ok', { invocation });
          },
        );
      },
    );
  },

  // ---------------------------------------------------------------------------
  // retry — create a new pending invocation from a failed predecessor
  // ---------------------------------------------------------------------------
  retry(input: Record<string, unknown>) {
    const invocation = String(input.invocation ?? '');
    const newInvocation = String(input.newInvocation ?? '');
    const startedAt = String(input.startedAt ?? '');

    let p = createProgram();
    p = get(p, 'invocations', invocation, 'existing');

    return branch(p,
      (bindings) => bindings.existing == null,
      (b) => complete(b, 'not_found', { message: `no invocation with id '${invocation}'` }),
      (b) => {
        // Extract whether the invocation has an error set
        const p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as InvocationRecord;
          return rec.error == null;
        }, '_notFailed');

        return branch(p2,
          (bindings) => bindings._notFailed as boolean,
          (b2) => complete(b2, 'not_failed', {
            message: `invocation '${invocation}' has not failed — only failed invocations may be retried`,
          }),
          (b2) => {
            const p3 = putFrom(b2, 'invocations', newInvocation, (bindings) => {
              const existing = bindings.existing as InvocationRecord;
              const retryRecord: InvocationRecord = {
                connection: existing.connection,
                binding: existing.binding,
                params: existing.params,
                startedAt,
                completedAt: null,
                dismissedAt: null,
                result: null,
                error: null,
                retriedFrom: invocation,
              };
              return retryRecord;
            });
            return complete(p3, 'ok', { invocation: newInvocation });
          },
        );
      },
    );
  },

  // ---------------------------------------------------------------------------
  // dismiss — mark an invocation as acknowledged by the user
  // ---------------------------------------------------------------------------
  dismiss(input: Record<string, unknown>) {
    const invocation = String(input.invocation ?? '');
    const dismissedAt = String(input.dismissedAt ?? '');

    let p = createProgram();
    p = get(p, 'invocations', invocation, 'existing');
    return branch(p,
      (bindings) => bindings.existing == null,
      (b) => complete(b, 'not_found', { message: `no invocation with id '${invocation}'` }),
      (b) => {
        const p2 = putFrom(b, 'invocations', invocation, (bindings) => {
          const existing = bindings.existing as InvocationRecord;
          return { ...existing, dismissedAt };
        });
        return complete(p2, 'ok', { invocation });
      },
    );
  },

  // ---------------------------------------------------------------------------
  // query — list invocations for a connection, with optional filters
  // ---------------------------------------------------------------------------
  query(input: Record<string, unknown>) {
    const connection = String(input.connection ?? '');
    const binding = input.binding != null && input.binding !== 'none'
      ? String(input.binding)
      : null;
    const since = input.since != null && input.since !== 'none'
      ? String(input.since)
      : null;

    let p = createProgram();
    p = find(p, 'invocations', 'allInvocations');
    p = traverse(p, 'allInvocations', '_item', (item) => {
      const rec = item as InvocationRecord;
      const matchesConnection = rec.connection === connection;
      const matchesBinding = binding == null || rec.binding === binding;
      const matchesSince = since == null || rec.startedAt >= since;
      if (matchesConnection && matchesBinding && matchesSince) {
        return complete(createProgram(), 'ok', { item });
      }
      return complete(createProgram(), 'skip', {});
    }, 'matched', {
      completionVariants: ['ok', 'skip'],
    });
    return complete(p, 'ok', { invocations: 'matched' });
  },

};

export const invocationHandler = autoInterpret(_handler);
export default invocationHandler;
