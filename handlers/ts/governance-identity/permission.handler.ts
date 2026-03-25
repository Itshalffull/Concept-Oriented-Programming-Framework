// @clef-handler style=functional
// Permission Concept Implementation
// Control which identities can perform which actions on which targets,
// with optional conditions.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  grant(input: Record<string, unknown>) {
    const who = input.who as string;
    const where = input.where as string;
    const what = input.what as string;
    const condition = (input.condition as string) || null;
    const grantedBy = input.grantedBy as string;

    if (!who || who.trim() === '') {
      return complete(createProgram(), 'error', { message: 'who is required' }) as StorageProgram<Result>;
    }
    if (!where || where.trim() === '') {
      return complete(createProgram(), 'error', { message: 'where is required' }) as StorageProgram<Result>;
    }
    if (!what || what.trim() === '') {
      return complete(createProgram(), 'error', { message: 'what is required' }) as StorageProgram<Result>;
    }

    // Use composite key: who:where:what
    const permKey = `${who.trim()}:${where.trim()}:${what.trim()}`;

    let p = createProgram();
    p = get(p, 'permission', permKey, 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      // Already granted
      complete(createProgram(), 'ok', { permission: permKey }),
      (() => {
        let b = createProgram();
        b = put(b, 'permission', permKey, {
          id: permKey,
          who: who.trim(),
          where: where.trim(),
          what: what.trim(),
          condition: condition || null,
          granted: true,
          grantedAt: new Date().toISOString(),
          grantedBy: grantedBy || '',
        });
        return complete(b, 'ok', { permission: permKey });
      })(),
    ) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const permission = input.permission as string;

    if (!permission || permission.trim() === '') {
      return complete(createProgram(), 'error', { message: 'permission is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'permission', permission, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { permission }),
      (() => {
        let b = createProgram();
        b = del(b, 'permission', permission);
        return complete(b, 'ok', { permission });
      })(),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const who = input.who as string;
    const where = input.where as string;
    const what = input.what as string;

    if (!who || who.trim() === '') {
      return complete(createProgram(), 'denied', { who, where, what }) as StorageProgram<Result>;
    }

    const permKey = `${who.trim()}:${where.trim()}:${what.trim()}`;

    let p = createProgram();
    p = get(p, 'permission', permKey, 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      complete(createProgram(), 'allowed', { permission: permKey }),
      complete(createProgram(), 'denied', { who, where, what }),
    ) as StorageProgram<Result>;
  },
};

export const permissionHandler = autoInterpret(_handler);
