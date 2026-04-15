// @clef-handler style=functional
// ============================================================
// Escalation Handler
//
// Redirects work or raises attention when normal handling is
// insufficient, tracking escalation chains with levels and
// resolution. See process-human suite.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `esc-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {

  register() {
    return complete(createProgram(), 'ok', { name: 'Escalation' });
  },

  // action escalate(source_ref: String, run_ref: String, trigger_type: String, reason: String, level: Int)
  //   -> ok(escalation: L, source_ref: String)
  escalate(input: Record<string, unknown>) {
    const sourceRef = input.source_ref as string;
    const runRef = input.run_ref as string;
    const triggerType = input.trigger_type as string;
    const reason = input.reason as string;
    const level = input.level as number;

    if (!sourceRef || sourceRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'source_ref is required' });
    }

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'escalation', id, {
      id,
      source_ref: sourceRef,
      run_ref: runRef,
      status: 'escalated',
      trigger_type: triggerType,
      target: null,
      level: level ?? 1,
      reason: reason || '',
      created_at: now,
      resolved_at: null,
    });
    return complete(p, 'ok', { escalation: id, source_ref: sourceRef });
  },

  // action accept(escalation: L, acceptor: String)
  //   -> ok(escalation: L)  — accepted
  //   -> ok(escalation: L)  — not in escalated status
  accept(input: Record<string, unknown>) {
    const escalationId = input.escalation as string;
    const acceptor = input.acceptor as string;

    if (!acceptor || acceptor.trim() === '') {
      return complete(createProgram(), 'error', { message: 'acceptor is required' });
    }

    let p = createProgram();
    p = get(p, 'escalation', escalationId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Escalation not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'escalation', escalationId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'escalated';
          },
          // Not in escalated status
          completeFrom(createProgram(), 'ok', () => ({ escalation: escalationId })),
          (() => {
            let c = createProgram();
            c = get(c, 'escalation', escalationId, 'existing');
            c = putFrom(c, 'escalation', escalationId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'accepted',
                target: acceptor,
              };
            });
            return complete(c, 'ok', { escalation: escalationId });
          })(),
        );
      })(),
    );
  },

  // action resolve(escalation: L, resolution: String)
  //   -> ok(escalation: L, source_ref: String, resolution: String) — resolved
  //   -> ok(escalation: L)                                         — must be accepted first
  resolve(input: Record<string, unknown>) {
    const escalationId = input.escalation as string;
    const resolution = input.resolution as string;

    if (!resolution || resolution.trim() === '') {
      return complete(createProgram(), 'error', { message: 'resolution is required' });
    }

    let p = createProgram();
    p = get(p, 'escalation', escalationId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Escalation not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'escalation', escalationId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'accepted';
          },
          // Must be accepted before resolving
          completeFrom(createProgram(), 'ok', () => ({ escalation: escalationId })),
          (() => {
            let c = createProgram();
            c = get(c, 'escalation', escalationId, 'existing');
            const now = new Date().toISOString();
            c = putFrom(c, 'escalation', escalationId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'resolved',
                resolved_at: now,
              };
            });
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                escalation: escalationId,
                source_ref: rec.source_ref as string,
                resolution,
              };
            });
          })(),
        );
      })(),
    );
  },

  // action re_escalate(escalation: L, new_level: Int, reason: String)
  //   -> ok(escalation: L) — re-escalated to higher level
  re_escalate(input: Record<string, unknown>) {
    const escalationId = input.escalation as string;
    const newLevel = input.new_level as number;
    const reason = input.reason as string;

    let p = createProgram();
    p = get(p, 'escalation', escalationId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Escalation not found' }),
      (() => {
        let c = createProgram();
        c = get(c, 'escalation', escalationId, 'existing');
        c = putFrom(c, 'escalation', escalationId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            level: newLevel,
            reason: reason || rec.reason,
            status: 'escalated',
            target: null,
          };
        });
        return complete(c, 'ok', { escalation: escalationId });
      })(),
    );
  },
};

export const escalationHandler = autoInterpret(_handler);
