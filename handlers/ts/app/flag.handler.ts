// @migrated dsl-constructs 2026-03-18
// Flag Concept Implementation
// Generalized user-entity toggle interactions (bookmarks, likes, follows, spam reports) with counts.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _flagHandler: FunctionalConceptHandler = {
  flag(input: Record<string, unknown>) {
    const flagging = input.flagging as string;
    const flagType = input.flagType as string;
    const entity = input.entity as string;
    const user = input.user as string;

    let p = createProgram();
    p = spGet(p, 'flag', flagging, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'User has already flagged this entity with this type' }),
      (b) => {
        let b2 = put(b, 'flag', flagging, { flagging, flagType, entity, user });
        // Update the count for this flagType + entity combination
        const countKey = `${flagType}:${entity}`;
        b2 = spGet(b2, 'flagCount', countKey, 'countRecord');
        b2 = put(b2, 'flagCount', countKey, { flagType, entity, count: 0 });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unflag(input: Record<string, unknown>) {
    const flagging = input.flagging as string;

    let p = createProgram();
    p = spGet(p, 'flag', flagging, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'flag', flagging);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Flagging does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  isFlagged(input: Record<string, unknown>) {
    const flagType = input.flagType as string;
    const entity = input.entity as string;
    const user = input.user as string;

    let p = createProgram();
    p = find(p, 'flag', {}, 'allFlags');
    return completeFrom(p, 'ok', (bindings) => {
      const allFlags = (bindings.allFlags as Array<Record<string, unknown>>) || [];
      const found = allFlags.some(f => f.flagType === flagType && f.entity === entity && f.user === user);
      return { flagged: found };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getCount(input: Record<string, unknown>) {
    const flagType = input.flagType as string;
    const entity = input.entity as string;

    const countKey = `${flagType}:${entity}`;
    let p = createProgram();
    p = spGet(p, 'flagCount', countKey, 'countRecord');
    p = branch(p, 'countRecord',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const record = bindings.countRecord as Record<string, unknown>;
          return { count: (record.count as number) || 0 };
        }),
      (b) => complete(b, 'ok', { count: 0 }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const flagHandler = autoInterpret(_flagHandler);

