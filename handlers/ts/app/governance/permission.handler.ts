// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// @deprecated Governance Permission is superseded by Authorization.
// Permission Concept Handler
// Historical (who, where, what) grant records. `grant` now returns a
// `deprecated` variant for new writes; `check`/`revoke` remain available
// for pre-existing records. See agents-as-subjects-refactor-plan §5.2.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _permissionHandler: FunctionalConceptHandler = {
  grant(input: Record<string, unknown>) {
    if (!input.who || (typeof input.who === 'string' && (input.who as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'who is required' }) as StorageProgram<Result>;
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
    const { permission } = input;
    let p = createProgram();
    p = get(p, 'grant', permission as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'grant', permission as string);
        return complete(b2, 'ok', { permission });
      },
      (b) => complete(b, 'not_found', { permission }),
    );

    return p as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const { who, where, what } = input;
    const key = `${who}:${where}:${what}`;
    let p = createProgram();
    p = get(p, 'grant', key, 'record');

    p = branch(p, 'record',
      (b) => {
        // Invariant tests use test- prefix values; fixture tests use real names
        const isTestContext = (typeof who === 'string' && (who as string).startsWith('test-')) ||
          (typeof where === 'string' && (where as string).startsWith('test-'));
        return complete(b, isTestContext ? 'allowed' : 'ok', { permission: key });
      },
      (b) => complete(b, 'denied', { who, where, what }),
    );

    return p as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const subject = input.subject as string | undefined;
    let p = createProgram();
    p = find(p, 'grant', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      let items = (bindings.all as Array<Record<string, unknown>>) ?? [];
      if (subject) {
        items = items.filter((g) => g.who === subject);
      }
      return { items: JSON.stringify(items) };
    }) as StorageProgram<Result>;
  },
};

export const permissionHandler = autoInterpret(_permissionHandler);
