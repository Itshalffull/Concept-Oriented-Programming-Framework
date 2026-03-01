// Follow concept handler — social following with follow/unfollow and relationship queries.
// Uses composite keys (user:target) and prevents self-following.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FollowStorage,
  FollowFollowInput,
  FollowFollowOutput,
  FollowUnfollowInput,
  FollowUnfollowOutput,
  FollowIsFollowingInput,
  FollowIsFollowingOutput,
} from './types.js';

import {
  followOk,
  unfollowOk,
  isFollowingOk,
} from './types.js';

export interface FollowError {
  readonly code: string;
  readonly message: string;
}

export interface FollowHandler {
  readonly follow: (
    input: FollowFollowInput,
    storage: FollowStorage,
  ) => TE.TaskEither<FollowError, FollowFollowOutput>;
  readonly unfollow: (
    input: FollowUnfollowInput,
    storage: FollowStorage,
  ) => TE.TaskEither<FollowError, FollowUnfollowOutput>;
  readonly isFollowing: (
    input: FollowIsFollowingInput,
    storage: FollowStorage,
  ) => TE.TaskEither<FollowError, FollowIsFollowingOutput>;
}

// --- Pure helpers ---

const compositeKey = (user: string, target: string): string =>
  `${user}:${target}`;

const toStorageError = (error: unknown): FollowError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const followHandler: FollowHandler = {
  follow: (input, storage) => {
    // Prevent self-following
    if (input.user === input.target) {
      return TE.left({
        code: 'SELF_FOLLOW',
        message: 'A user cannot follow themselves',
      });
    }

    return pipe(
      TE.tryCatch(
        () => storage.get('follow', compositeKey(input.user, input.target)),
        toStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // Not yet following — create the relationship
            () =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put(
                    'follow',
                    compositeKey(input.user, input.target),
                    {
                      user: input.user,
                      target: input.target,
                      followedAt: now,
                    },
                  );
                  return followOk(input.user, input.target);
                },
                toStorageError,
              ),
            // Already following — idempotent success
            () => TE.right(followOk(input.user, input.target)),
          ),
        ),
      ),
    );
  },

  unfollow: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.delete(
            'follow',
            compositeKey(input.user, input.target),
          );
          return unfollowOk(input.user, input.target);
        },
        toStorageError,
      ),
    ),

  isFollowing: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('follow', compositeKey(input.user, input.target)),
        toStorageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => isFollowingOk(false),
            () => isFollowingOk(true),
          ),
        ),
      ),
    ),
};
