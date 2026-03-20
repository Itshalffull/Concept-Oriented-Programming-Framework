// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Guard Concept Handler
// Pre/post execution safety checks (Zodiac Guard pattern).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _guardHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const id = `guard-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'guard', id, {
      id, name: input.name, targetAction: input.targetAction,
      checkType: input.checkType, condition: input.condition,
      enabled: true, registeredAt: new Date().toISOString(),
    });
    return complete(p, 'registered', { guard: id }) as StorageProgram<Result>;
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
      (b) => complete(b, 'allowed', { guard }),
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
      (b) => complete(b, 'passed', { guard }),
      (b) => complete(b, 'guard_disabled', { guard }),
    );

    return p as StorageProgram<Result>;
  },

  enable(input: Record<string, unknown>) {
    const { guard } = input;
    let p = createProgram();
    p = get(p, 'guard', guard as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, enabled: true };
        }, 'updated');
        b2 = putFrom(b2, 'guard', guard as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'enabled', { guard });
      },
      (b) => complete(b, 'not_found', { guard }),
    );

    return p as StorageProgram<Result>;
  },

  disable(input: Record<string, unknown>) {
    const { guard } = input;
    let p = createProgram();
    p = get(p, 'guard', guard as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, enabled: false };
        }, 'updated');
        b2 = putFrom(b2, 'guard', guard as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'disabled', { guard });
      },
      (b) => complete(b, 'not_found', { guard }),
    );

    return p as StorageProgram<Result>;
  },
};

export const guardHandler = autoInterpret(_guardHandler);
