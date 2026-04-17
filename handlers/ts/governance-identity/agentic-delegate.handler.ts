// @clef-handler style=functional
// AgenticDelegate Concept Implementation
// Represent an LLM or autonomous agent as a standing governance participant
// with defined delegation scope, boundaries, capabilities, and accountability.
// Supervised per-action approval flows belong in ActionRequest, not here.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `delegate-${++idCounter}`;
}

const VALID_AUTONOMY_LEVELS = new Set(['Supervised', 'Autonomous', 'Constrained']);
const VALID_SCOPE_KINDS = new Set(['action_set', 'workspace', 'process_role', 'pilot_mode']);

function toOptStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name || input.agentType) as string;
    const principal = input.principal as string;
    const autonomyLevel = input.autonomyLevel as string;
    const allowedActions = (input.allowedActions || input.boundaries) as string[];
    const scopeKind = toOptStr(input.scopeKind);
    const scopePayload = toOptStr(input.scopePayload);

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    if (scopeKind !== null && !VALID_SCOPE_KINDS.has(scopeKind)) {
      return complete(createProgram(), 'error', {
        message: `scopeKind must be one of: ${[...VALID_SCOPE_KINDS].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const id = nextId();

    let p = createProgram();
    p = put(p, 'agenticDelegate', id, {
      id,
      name: name.trim(),
      agentType: name.trim(),
      principal: principal || null,
      autonomyLevel: autonomyLevel || 'Supervised',
      allowedActions: allowedActions || [],
      systemPrompt: input.systemPrompt || null,
      boundaries: input.boundaries || null,
      activeRoles: [],
      actionLog: [],
      scopeKind,
      scopePayload,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { id, delegate: id }) as StorageProgram<Result>;
  },

  assumeRole(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const role = (input.role || input.roleId) as string;

    if (!delegate || (typeof delegate === 'string' && delegate.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    if (!role || (typeof role === 'string' && role.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agenticDelegate', delegate, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { delegate }),
      (() => {
        let b = createProgram();
        b = get(b, 'agenticDelegate', delegate, 'rec');
        b = putFrom(b, 'agenticDelegate', delegate, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const activeRoles = (rec.activeRoles as string[]) || [];
          if (activeRoles.includes(role)) return rec;
          return { ...rec, activeRoles: [...activeRoles, role] };
        });
        return complete(b, 'ok', { delegate, role, roleId: role });
      })(),
    ) as StorageProgram<Result>;
  },

  releaseRole(input: Record<string, unknown>) {
    const delegate = input.delegate as string;

    if (!delegate || (typeof delegate === 'string' && delegate.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agenticDelegate', delegate, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { delegate }),
      (() => {
        let b = createProgram();
        b = get(b, 'agenticDelegate', delegate, 'rec');
        b = putFrom(b, 'agenticDelegate', delegate, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, activeRoles: [] };
        });
        return complete(b, 'ok', { delegate });
      })(),
    ) as StorageProgram<Result>;
  },

  recordAction(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const action = input.action as string;
    const outcome = input.outcome as string;

    if (!action || (typeof action === 'string' && action.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'action is required' }) as StorageProgram<Result>;
    }
    if (!outcome || (typeof outcome === 'string' && outcome.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'outcome is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agenticDelegate', delegate, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { delegate }),
      (() => {
        let b = createProgram();
        b = get(b, 'agenticDelegate', delegate, 'rec');
        b = putFrom(b, 'agenticDelegate', delegate, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const log = (rec.actionLog as Array<Record<string, unknown>>) || [];
          return {
            ...rec,
            actionLog: [...log, {
              action,
              timestamp: new Date().toISOString(),
              outcome,
            }],
          };
        });
        return complete(b, 'ok', { delegate, action });
      })(),
    ) as StorageProgram<Result>;
  },

  escalate(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const action = input.action as string;
    const reason = input.reason as string;

    if (!reason || (typeof reason === 'string' && reason.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'reason is required' }) as StorageProgram<Result>;
    }

    return complete(createProgram(), 'ok', { delegate, action, reason }) as StorageProgram<Result>;
  },

  updateAutonomy(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const autonomyLevel = input.autonomyLevel as string;

    if (!delegate || (typeof delegate === 'string' && delegate.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    if (!autonomyLevel || !VALID_AUTONOMY_LEVELS.has(autonomyLevel)) {
      return complete(createProgram(), 'error', { message: 'autonomyLevel must be Supervised, Autonomous, or Constrained' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agenticDelegate', delegate, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { delegate }),
      (() => {
        let b = createProgram();
        b = get(b, 'agenticDelegate', delegate, 'rec');
        b = putFrom(b, 'agenticDelegate', delegate, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, autonomyLevel };
        });
        return complete(b, 'ok', { delegate });
      })(),
    ) as StorageProgram<Result>;
  },

  updateScope(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const scopeKind = toOptStr(input.scopeKind);
    const scopePayload = toOptStr(input.scopePayload);

    if (scopeKind !== null && !VALID_SCOPE_KINDS.has(scopeKind)) {
      return complete(createProgram(), 'error', {
        message: `scopeKind must be one of: ${[...VALID_SCOPE_KINDS].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agenticDelegate', delegate, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { delegate }),
      (() => {
        let b = createProgram();
        b = get(b, 'agenticDelegate', delegate, 'rec');
        b = putFrom(b, 'agenticDelegate', delegate, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, scopeKind, scopePayload };
        });
        return completeFrom(b, 'ok', () => ({ delegate, scopeKind, scopePayload }));
      })(),
    ) as StorageProgram<Result>;
  },
};

export const agenticDelegateHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetAgenticDelegate(): void {
  idCounter = 0;
}
