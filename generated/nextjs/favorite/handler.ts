// Favorite concept handler — favoriting/bookmarking entities with toggle and count tracking.
// Uses composite keys (user:article) for uniqueness.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FavoriteStorage,
  FavoriteFavoriteInput,
  FavoriteFavoriteOutput,
  FavoriteUnfavoriteInput,
  FavoriteUnfavoriteOutput,
  FavoriteIsFavoritedInput,
  FavoriteIsFavoritedOutput,
  FavoriteCountInput,
  FavoriteCountOutput,
} from './types.js';

import {
  favoriteOk,
  unfavoriteOk,
  isFavoritedOk,
  countOk,
} from './types.js';

export interface FavoriteError {
  readonly code: string;
  readonly message: string;
}

export interface FavoriteHandler {
  readonly favorite: (
    input: FavoriteFavoriteInput,
    storage: FavoriteStorage,
  ) => TE.TaskEither<FavoriteError, FavoriteFavoriteOutput>;
  readonly unfavorite: (
    input: FavoriteUnfavoriteInput,
    storage: FavoriteStorage,
  ) => TE.TaskEither<FavoriteError, FavoriteUnfavoriteOutput>;
  readonly isFavorited: (
    input: FavoriteIsFavoritedInput,
    storage: FavoriteStorage,
  ) => TE.TaskEither<FavoriteError, FavoriteIsFavoritedOutput>;
  readonly count: (
    input: FavoriteCountInput,
    storage: FavoriteStorage,
  ) => TE.TaskEither<FavoriteError, FavoriteCountOutput>;
}

// --- Pure helpers ---

const compositeKey = (user: string, article: string): string =>
  `${user}:${article}`;

const toStorageError = (error: unknown): FavoriteError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const favoriteHandler: FavoriteHandler = {
  favorite: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('favorite', compositeKey(input.user, input.article)),
        toStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // Not yet favorited — create the record
            () =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put(
                    'favorite',
                    compositeKey(input.user, input.article),
                    {
                      user: input.user,
                      article: input.article,
                      favoritedAt: now,
                    },
                  );
                  return favoriteOk(input.user, input.article);
                },
                toStorageError,
              ),
            // Already favorited — idempotent, return success
            () => TE.right(favoriteOk(input.user, input.article)),
          ),
        ),
      ),
    ),

  unfavorite: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.delete(
            'favorite',
            compositeKey(input.user, input.article),
          );
          return unfavoriteOk(input.user, input.article);
        },
        toStorageError,
      ),
    ),

  isFavorited: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('favorite', compositeKey(input.user, input.article)),
        toStorageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => isFavoritedOk(false),
            () => isFavoritedOk(true),
          ),
        ),
      ),
    ),

  count: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('favorite', {
            article: input.article,
          });
          return countOk(records.length);
        },
        toStorageError,
      ),
    ),
};
