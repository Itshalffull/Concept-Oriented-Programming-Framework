// @migrated dsl-constructs 2026-03-18
// Follow Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const followHandler: FunctionalConceptHandler = {
  follow(input: Record<string, unknown>) {
    const user = input.user as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'follow', user, 'existing');
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const following: string[] = existing
        ? [...(existing.following as string[])]
        : [];
      if (!following.includes(target)) {
        following.push(target);
      }
      return { user, following };
    }, 'followData');
    p = putFrom(p, 'follow', user, (bindings) => bindings.followData as Record<string, unknown>);
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
        }, 'unfollowData');
        const b2 = putFrom(bm, 'follow', user, (bindings) => bindings.unfollowData as Record<string, unknown>);
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
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const following: string[] = existing
          ? (existing.following as string[])
          : [];
        return { following: following.includes(target) };
      }),
      (b) => complete(b, 'ok', { following: false }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
