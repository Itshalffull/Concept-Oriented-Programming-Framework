// @clef-handler style=functional
// @deprecated Governance Permission is superseded by Authorization.
// Permission Concept Implementation
// Historical (who, where, what) grant records. `grant` now returns a
// `deprecated` variant for new writes; `check`/`revoke` remain available
// for pre-existing records. New executable grants MUST go through
// Authorization/grantPermission. See agents-as-subjects-refactor-plan §5.2.
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

    if (!who || who.trim() === '') {
      return complete(createProgram(), 'error', { message: 'who is required' }) as StorageProgram<Result>;
    }
    if (!where || where.trim() === '') {
      return complete(createProgram(), 'error', { message: 'where is required' }) as StorageProgram<Result>;
    }
    if (!what || what.trim() === '') {
      return complete(createProgram(), 'error', { message: 'what is required' }) as StorageProgram<Result>;
    }

    // Governance Permission is deprecated: new writes are refused. Executable
    // grants must go through Authorization/grantPermission instead.
    return complete(
      createProgram(),
      'deprecated',
      {
        message:
          'Permission/grant is deprecated; route executable access grants through Authorization/grantPermission.',
      },
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
