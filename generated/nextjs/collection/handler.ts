// Collection — handler.ts
// Organize content into concrete, manually curated sets with
// membership management and schema enforcement.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CollectionStorage,
  CollectionCreateInput,
  CollectionCreateOutput,
  CollectionAddMemberInput,
  CollectionAddMemberOutput,
  CollectionRemoveMemberInput,
  CollectionRemoveMemberOutput,
  CollectionGetMembersInput,
  CollectionGetMembersOutput,
  CollectionSetSchemaInput,
  CollectionSetSchemaOutput,
} from './types.js';

import {
  createOk,
  createExists,
  addMemberOk,
  addMemberNotfound,
  removeMemberOk,
  removeMemberNotfound,
  getMembersOk,
  getMembersNotfound,
  setSchemaOk,
  setSchemaNotfound,
} from './types.js';

export interface CollectionError {
  readonly code: string;
  readonly message: string;
}

export interface CollectionHandler {
  readonly create: (
    input: CollectionCreateInput,
    storage: CollectionStorage,
  ) => TE.TaskEither<CollectionError, CollectionCreateOutput>;
  readonly addMember: (
    input: CollectionAddMemberInput,
    storage: CollectionStorage,
  ) => TE.TaskEither<CollectionError, CollectionAddMemberOutput>;
  readonly removeMember: (
    input: CollectionRemoveMemberInput,
    storage: CollectionStorage,
  ) => TE.TaskEither<CollectionError, CollectionRemoveMemberOutput>;
  readonly getMembers: (
    input: CollectionGetMembersInput,
    storage: CollectionStorage,
  ) => TE.TaskEither<CollectionError, CollectionGetMembersOutput>;
  readonly setSchema: (
    input: CollectionSetSchemaInput,
    storage: CollectionStorage,
  ) => TE.TaskEither<CollectionError, CollectionSetSchemaOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): CollectionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const parseMembers = (raw: unknown): readonly string[] => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return raw.length > 0 ? raw.split(',').map((m) => m.trim()) : [];
    }
  }
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  return [];
};

// --- Implementation ---

export const collectionHandler: CollectionHandler = {
  // Creates a new collection with the given type and schema.
  // Returns exists variant if collection identity is already taken.
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('collection', input.collection),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const record: Record<string, unknown> = {
                    id: input.collection,
                    type: input.type,
                    schema: input.schema,
                    members: JSON.stringify([]),
                    templates: JSON.stringify([]),
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  };
                  await storage.put('collection', input.collection, record);
                  return createOk();
                },
                storageError,
              ),
            () =>
              TE.right<CollectionError, CollectionCreateOutput>(createExists()),
          ),
        ),
      ),
    ),

  // Adds a member to the collection. Prevents duplicate membership.
  // Returns notfound if the collection does not exist.
  addMember: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('collection', input.collection),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CollectionError, CollectionAddMemberOutput>(addMemberNotfound()),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const members = parseMembers(existing.members);

                  // Idempotent: if already a member, still return ok
                  if (members.includes(input.member)) {
                    return addMemberOk();
                  }

                  const updatedMembers = [...members, input.member];
                  const updated = {
                    ...existing,
                    members: JSON.stringify(updatedMembers),
                    updatedAt: nowISO(),
                  };
                  await storage.put('collection', input.collection, updated);
                  return addMemberOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Removes a member from the collection.
  // Returns notfound if the collection does not exist.
  removeMember: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('collection', input.collection),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CollectionError, CollectionRemoveMemberOutput>(removeMemberNotfound()),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const members = parseMembers(existing.members);
                  const filtered = members.filter((m) => m !== input.member);
                  const updated = {
                    ...existing,
                    members: JSON.stringify(filtered),
                    updatedAt: nowISO(),
                  };
                  await storage.put('collection', input.collection, updated);
                  return removeMemberOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Returns all members of the collection as a comma-separated string.
  // Returns notfound if the collection does not exist.
  getMembers: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('collection', input.collection),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CollectionError, CollectionGetMembersOutput>(getMembersNotfound()),
            (existing) => {
              const members = parseMembers(existing.members);
              return TE.right<CollectionError, CollectionGetMembersOutput>(
                getMembersOk(members.join(',')),
              );
            },
          ),
        ),
      ),
    ),

  // Updates the schema for the collection.
  // Returns notfound if the collection does not exist.
  setSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('collection', input.collection),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CollectionError, CollectionSetSchemaOutput>(setSchemaNotfound()),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    schema: input.schema,
                    updatedAt: nowISO(),
                  };
                  await storage.put('collection', input.collection, updated);
                  return setSchemaOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
