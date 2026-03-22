// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Permission Concept Handler
// (who, where, what) grant model with optional conditions.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _permissionHandler: FunctionalConceptHandler = {
  grant(input: Record<string, unknown>) {
    const { who, where, what, condition, grantedBy } = input;
    const key = `${who}:${where}:${what}`;
    let p = createProgram();
    p = get(p, 'grant', key, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'already_granted', { permission: key }),
      (b) => {
        let b2 = put(b, 'grant', key, { who, where, what, condition, grantedBy, grantedAt: new Date().toISOString(), granted: true });
        return complete(b2, 'ok', { permission: key });
      },
    );

    return p as StorageProgram<Result>;
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
      (b) => complete(b, 'allowed', { permission: key }),
      (b) => complete(b, 'denied', { who, where, what }),
    );

    return p as StorageProgram<Result>;
  },
};

export const permissionHandler = autoInterpret(_permissionHandler);
