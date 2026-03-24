// @clef-handler style=functional
// WebhookInbox Concept Implementation
// Receive and correlate inbound events from external systems to waiting
// process instances using correlation keys.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _webhookInboxHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'WebhookInbox' }) as StorageProgram<Result>;
  },

  register_hook(input: Record<string, unknown>) {
    // Named 'register' in the spec, but 'register' is reserved for concept registration.
    // Callers should map action name 'register' -> 'register_hook' or use the spec action name.
    return this._doRegister(input);
  },

  // Internal implementation of the register action from the spec
  _doRegister(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const stepRef = input.step_ref as string;
    const eventType = input.event_type as string;
    const correlationKey = input.correlation_key as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const hookId = `hook-${correlationKey}-${Date.now()}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'hook', hookId, {
      hook: hookId,
      run_ref: runRef,
      step_ref: stepRef,
      event_type: eventType,
      correlation_key: correlationKey,
      status: 'waiting',
      payload: null,
      registered_at: now,
      received_at: null,
    });
    return complete(p, 'ok', { hook: hookId, run_ref: runRef }) as StorageProgram<Result>;
  },

  receive(input: Record<string, unknown>) {
    const correlationKey = input.correlation_key as string;
    const eventType = input.event_type as string;
    const payload = input.payload as string;

    if (!correlationKey || correlationKey.trim() === '') {
      return complete(createProgram(), 'error', { message: 'correlation_key is required' }) as StorageProgram<Result>;
    }

    // Find a waiting hook matching correlation_key and event_type
    let p = createProgram();
    p = find(p, 'hook', { correlation_key: correlationKey, event_type: eventType, status: 'waiting' }, 'matches');
    p = mapBindings(p, (bindings) => {
      const matches = (bindings.matches as Array<Record<string, unknown>>) || [];
      return matches.length > 0 ? matches[0] : null;
    }, 'matched');

    return branch(p,
      (bindings) => bindings.matched != null,
      (() => {
        const now = new Date().toISOString();
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const hook = bindings.matched as Record<string, unknown>;
          return hook.hook as string;
        }, 'hookId');
        b = putFrom(b, 'hook', '_dynamic', (bindings) => {
          const hook = bindings.matched as Record<string, unknown>;
          return {
            ...hook,
            status: 'received',
            payload,
            received_at: now,
          };
        });
        return completeFrom(b, 'ok', (bindings) => {
          const hook = bindings.matched as Record<string, unknown>;
          return {
            hook: hook.hook as string,
            run_ref: hook.run_ref as string,
            step_ref: hook.step_ref as string,
            payload,
          };
        });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { correlation_key: correlationKey });
      })(),
    ) as StorageProgram<Result>;
  },

  expire(input: Record<string, unknown>) {
    const hook = input.hook as string;

    let p = createProgram();
    p = spGet(p, 'hook', hook, 'existing');

    return branch(p,
      (bindings) => {
        const rec = bindings.existing as Record<string, unknown> | null;
        return rec != null && rec.status === 'waiting';
      },
      (() => {
        let b = createProgram();
        b = putFrom(b, 'hook', hook, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            status: 'expired',
          };
        });
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            hook,
            run_ref: rec.run_ref as string,
            step_ref: rec.step_ref as string,
          };
        });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { hook });
      })(),
    ) as StorageProgram<Result>;
  },

  ack(input: Record<string, unknown>) {
    const hook = input.hook as string;

    let p = createProgram();
    p = spGet(p, 'hook', hook, 'existing');

    return branch(p,
      (bindings) => {
        const rec = bindings.existing as Record<string, unknown> | null;
        return rec != null && rec.status === 'received';
      },
      (() => {
        let b = createProgram();
        b = putFrom(b, 'hook', hook, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            status: 'acknowledged',
          };
        });
        return complete(b, 'ok', { hook });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { hook });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const webhookInboxHandler = autoInterpret(_webhookInboxHandler);
