// @migrated dsl-constructs 2026-03-18
// Follow Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const followHandler: FunctionalConceptHandler = {
  follow(input: Record<string, unknown>) {
    const user = input.user as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'follow', user, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const following: string[] = existing
            ? (existing.following as string[])
            : [];
          if (!following.includes(target)) {
            following.push(target);
          }
          return { user, following };
        }, 'followData');
      },
      (b) => {
        return mapBindings(b, () => {
          return { user, following: [target] };
        }, 'followData');
      },
    );
    p = put(p, 'follow', user, { user, following: [] });
    return complete(p, 'ok', { user, target }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unfollow(input: Record<string, unknown>) {
    const user = input.user as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'follow', user, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const bm = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const following = (existing.following as string[]).filter(t => t !== target);
          return { user, following };
        }, 'followData');
        let b2 = put(bm, 'follow', user, { user, following: [] });
        return complete(b2, 'ok', { user, target });
      },
      (b) => complete(b, 'ok', { user, target }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  isFollowing(input: Record<string, unknown>) {
    const user = input.user as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'follow', user, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const following: string[] = existing
            ? (existing.following as string[])
            : [];
          return following.includes(target);
        }, 'isFollowing');
      },
      (b) => {
        return mapBindings(b, () => false, 'isFollowing');
      },
    );
    return complete(p, 'ok', { following: false }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
