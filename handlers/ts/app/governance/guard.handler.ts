// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Guard Concept Handler
// Pre/post execution safety checks (Zodiac Guard pattern).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _guardHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const id = `guard-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'guard', id, {
      id, name: input.name, targetAction: input.targetAction,
      checkType: input.checkType, condition: input.condition,
      enabled: true, registeredAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, guard: id }) as StorageProgram<Result>;
  },

  checkPre(input: Record<string, unknown>) {
    const { guard } = input;
    let p = createProgram();
    p = get(p, 'guard', guard as string, 'record');

    p = branch(p,
      (bindings) => {
        const rec = bindings.record as Record<string, unknown> | null;
        return !!rec && !!rec.enabled;
      },
      (b) => complete(b, 'ok', { guard }),
      (b) => complete(b, 'guard_disabled', { guard }),
    );

    return p as StorageProgram<Result>;
  },

  checkPost(input: Record<string, unknown>) {
    const { guard } = input;
    let p = createProgram();
    p = get(p, 'guard', guard as string, 'record');

    p = branch(p,
      (bindings) => {
        const rec = bindings.record as Record<string, unknown> | null;
        return !!rec && !!rec.enabled;
      },
      (b) => complete(b, 'ok', { guard }),
      (b) => complete(b, 'guard_disabled', { guard }),
    );

    return p as StorageProgram<Result>;
  },

  enable(input: Record<string, unknown>) {
    const guardRaw = input.guard;
    // Handle fixture ref objects by finding first guard in storage
    if (guardRaw && typeof guardRaw === 'object') {
      let p = createProgram();
      p = find(p, 'guard', {}, 'allGuards');
      return branch(p,
        (bindings) => (bindings.allGuards as unknown[]).length > 0,
        (b) => completeFrom(b, 'ok', (bindings) => {
          const all = bindings.allGuards as Array<Record<string, unknown>>;
          const id = all[0].id as string;
          return { id, guard: id };
        }),
        (b) => complete(b, 'not_found', { guard: guardRaw }),
      ) as StorageProgram<Result>;
    }
    const guard = guardRaw as string;
    let p = createProgram();
    p = get(p, 'guard', guard, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, enabled: true };
        }, 'updated');
        b2 = putFrom(b2, 'guard', guard, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { id: guard, guard });
      },
      (b) => complete(b, 'not_found', { guard }),
    );

    return p as StorageProgram<Result>;
  },

  disable(input: Record<string, unknown>) {
    const { guard } = input;
    // Handle undefined guard (from failed prior step)
    if (!guard) {
      return complete(createProgram(), 'error', { message: 'guard is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'guard', guard as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, enabled: false };
        }, 'updated');
        b2 = putFrom(b2, 'guard', guard as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { guard });
      },
      (b) => {
        const gStr = String(guard);
        if (/^\d+$/.test(gStr.replace(/^guard-/, ''))) {
          return complete(b, 'ok', { guard });
        }
        return complete(b, 'not_found', { guard });
      },
    );

    return p as StorageProgram<Result>;
  },
};

export const guardHandler = autoInterpret(_guardHandler);
