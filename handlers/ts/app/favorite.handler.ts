// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Favorite Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _favoriteHandler: FunctionalConceptHandler = {
  favorite(input: Record<string, unknown>) {
    const user = input.user as string;
    const article = input.article as string;

    let p = createProgram();
    p = spGet(p, 'favorite', user, 'existing');
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const favorites: string[] = existing
        ? [...(existing.favorites as string[])]
        : [];
      if (!favorites.includes(article)) {
        favorites.push(article);
      }
      return { user, favorites };
    }, 'favData');
    p = putFrom(p, 'favorite', user, (bindings) => bindings.favData as Record<string, unknown>);
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
        }, 'unfavData');
        const b2 = putFrom(bm, 'favorite', user, (bindings) => bindings.unfavData as Record<string, unknown>);
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
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const favorites: string[] = existing
          ? (existing.favorites as string[])
          : [];
        return { favorited: favorites.includes(article) };
      }),
      (b) => complete(b, 'error', { message: `User "${user}" has no favorites` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  count(input: Record<string, unknown>) {
    const article = input.article as string;

    let p = createProgram();
    p = find(p, 'favorite', {}, 'allUsers');
    return completeFrom(p, 'dynamic', (bindings) => {
      const allUsers = (bindings.allUsers as Array<Record<string, unknown>>) || [];
      let count = 0;
      for (const record of allUsers) {
        const favorites = record.favorites as string[];
        if (favorites && favorites.includes(article)) {
          count++;
        }
      }
      if (count === 0) {
        return { variant: 'error', message: `No favorites found for article "${article}"` };
      }
      return { variant: 'ok', count };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const favoriteHandler = autoInterpret(_favoriteHandler);

