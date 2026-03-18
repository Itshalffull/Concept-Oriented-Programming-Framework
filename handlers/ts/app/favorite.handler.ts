// @migrated dsl-constructs 2026-03-18
// Favorite Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const favoriteHandler: FunctionalConceptHandler = {
  favorite(input: Record<string, unknown>) {
    const user = input.user as string;
    const article = input.article as string;

    let p = createProgram();
    p = spGet(p, 'favorite', user, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const bm = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const favorites: string[] = existing
            ? (existing.favorites as string[])
            : [];
          if (!favorites.includes(article)) {
            favorites.push(article);
          }
          return { user, favorites };
        }, 'favData');
        return bm;
      },
      (b) => {
        return mapBindings(b, () => {
          return { user, favorites: [article] };
        }, 'favData');
      },
    );
    p = mapBindings(p, (bindings) => {
      return bindings.favData as Record<string, unknown>;
    }, 'putPayload');
    p = put(p, 'favorite', user, { user, favorites: [] });
    return complete(p, 'ok', { user, article }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unfavorite(input: Record<string, unknown>) {
    const user = input.user as string;
    const article = input.article as string;

    let p = createProgram();
    p = spGet(p, 'favorite', user, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const bm = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const favorites = (existing.favorites as string[]).filter(a => a !== article);
          return { user, favorites };
        }, 'favData');
        let b2 = put(bm, 'favorite', user, { user, favorites: [] });
        return complete(b2, 'ok', { user, article });
      },
      (b) => complete(b, 'ok', { user, article }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  isFavorited(input: Record<string, unknown>) {
    const user = input.user as string;
    const article = input.article as string;

    let p = createProgram();
    p = spGet(p, 'favorite', user, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const favorites: string[] = existing
            ? (existing.favorites as string[])
            : [];
          return favorites.includes(article);
        }, 'favorited');
      },
      (b) => {
        return mapBindings(b, () => false, 'favorited');
      },
    );
    return complete(p, 'ok', { favorited: false }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  count(input: Record<string, unknown>) {
    const article = input.article as string;

    let p = createProgram();
    p = find(p, 'favorite', {}, 'allUsers');
    p = mapBindings(p, (bindings) => {
      const allUsers = (bindings.allUsers as Array<Record<string, unknown>>) || [];
      let count = 0;
      for (const record of allUsers) {
        const favorites = record.favorites as string[];
        if (favorites.includes(article)) {
          count++;
        }
      }
      return count;
    }, 'count');
    return complete(p, 'ok', { count: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
