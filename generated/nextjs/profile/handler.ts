// Profile concept handler — user profile management with bio, avatar, and settings.
// Separate from auth identity. Pure fp-ts implementation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProfileStorage,
  ProfileUpdateInput,
  ProfileUpdateOutput,
  ProfileGetInput,
  ProfileGetOutput,
} from './types.js';

import {
  updateOk,
  getOk,
  getNotfound,
} from './types.js';

export interface ProfileError {
  readonly code: string;
  readonly message: string;
}

export interface ProfileHandler {
  readonly update: (
    input: ProfileUpdateInput,
    storage: ProfileStorage,
  ) => TE.TaskEither<ProfileError, ProfileUpdateOutput>;
  readonly get: (
    input: ProfileGetInput,
    storage: ProfileStorage,
  ) => TE.TaskEither<ProfileError, ProfileGetOutput>;
}

// --- Pure helpers ---

const MAX_BIO_LENGTH = 2000;

const sanitizeBio = (bio: string): string =>
  bio.trim().slice(0, MAX_BIO_LENGTH);

const normalizeImageUrl = (image: string): string => {
  const trimmed = image.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return trimmed;
};

const toStorageError = (error: unknown): ProfileError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const profileHandler: ProfileHandler = {
  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('profile', input.user),
        toStorageError,
      ),
      TE.chain((existing) => {
        const sanitizedBio = sanitizeBio(input.bio);
        const normalizedImage = normalizeImageUrl(input.image);
        const now = new Date().toISOString();

        return pipe(
          O.fromNullable(existing),
          O.fold(
            // No existing profile, create a new one
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('profile', input.user, {
                    user: input.user,
                    bio: sanitizedBio,
                    image: normalizedImage,
                    createdAt: now,
                    updatedAt: now,
                  });
                  return updateOk(input.user, sanitizedBio, normalizedImage);
                },
                toStorageError,
              ),
            // Existing profile, merge updates
            (found) =>
              TE.tryCatch(
                async () => {
                  const merged = {
                    ...found,
                    user: input.user,
                    bio: sanitizedBio,
                    image: normalizedImage,
                    updatedAt: now,
                  };
                  await storage.put('profile', input.user, merged);
                  return updateOk(input.user, sanitizedBio, normalizedImage);
                },
                toStorageError,
              ),
          ),
        );
      }),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('profile', input.user),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                getNotfound(`Profile not found for user '${input.user}'`),
              ),
            (found) =>
              TE.right(
                getOk(
                  input.user,
                  typeof found['bio'] === 'string' ? found['bio'] as string : '',
                  typeof found['image'] === 'string' ? found['image'] as string : '',
                ),
              ),
          ),
        ),
      ),
    ),
};
