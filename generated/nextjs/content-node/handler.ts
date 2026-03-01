// ContentNode — handler.ts
// Universal typed, addressable unit of content. Every piece of data
// is a ContentNode with type, body, metadata, and timestamps.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ContentNodeStorage,
  ContentNodeCreateInput,
  ContentNodeCreateOutput,
  ContentNodeUpdateInput,
  ContentNodeUpdateOutput,
  ContentNodeDeleteInput,
  ContentNodeDeleteOutput,
  ContentNodeGetInput,
  ContentNodeGetOutput,
  ContentNodeSetMetadataInput,
  ContentNodeSetMetadataOutput,
  ContentNodeChangeTypeInput,
  ContentNodeChangeTypeOutput,
} from './types.js';

import {
  createOk,
  createExists,
  updateOk,
  updateNotfound,
  deleteOk,
  deleteNotfound,
  getOk,
  getNotfound,
  setMetadataOk,
  setMetadataNotfound,
  changeTypeOk,
  changeTypeNotfound,
} from './types.js';

export interface ContentNodeError {
  readonly code: string;
  readonly message: string;
}

export interface ContentNodeHandler {
  readonly create: (
    input: ContentNodeCreateInput,
    storage: ContentNodeStorage,
  ) => TE.TaskEither<ContentNodeError, ContentNodeCreateOutput>;
  readonly update: (
    input: ContentNodeUpdateInput,
    storage: ContentNodeStorage,
  ) => TE.TaskEither<ContentNodeError, ContentNodeUpdateOutput>;
  readonly delete: (
    input: ContentNodeDeleteInput,
    storage: ContentNodeStorage,
  ) => TE.TaskEither<ContentNodeError, ContentNodeDeleteOutput>;
  readonly get: (
    input: ContentNodeGetInput,
    storage: ContentNodeStorage,
  ) => TE.TaskEither<ContentNodeError, ContentNodeGetOutput>;
  readonly setMetadata: (
    input: ContentNodeSetMetadataInput,
    storage: ContentNodeStorage,
  ) => TE.TaskEither<ContentNodeError, ContentNodeSetMetadataOutput>;
  readonly changeType: (
    input: ContentNodeChangeTypeInput,
    storage: ContentNodeStorage,
  ) => TE.TaskEither<ContentNodeError, ContentNodeChangeTypeOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): ContentNodeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

// --- Implementation ---

export const contentNodeHandler: ContentNodeHandler = {
  // Add node to nodes set. Store type, content, createdBy,
  // and set createdAt and updatedAt to current time.
  // Returns exists if the node identity is already taken.
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contentnode', input.node),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const timestamp = nowISO();
                  const record: Record<string, unknown> = {
                    id: input.node,
                    type: input.type,
                    content: input.content,
                    metadata: '',
                    createdBy: input.createdBy,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  };
                  await storage.put('contentnode', input.node, record);
                  return createOk(input.node);
                },
                storageError,
              ),
            () =>
              TE.right<ContentNodeError, ContentNodeCreateOutput>(
                createExists(`already exists`),
              ),
          ),
        ),
      ),
    ),

  // Update node content and set updatedAt to current time.
  // Returns notfound if the node does not exist.
  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contentnode', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentNodeError, ContentNodeUpdateOutput>(
              updateNotfound(`Node ${input.node} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    content: input.content,
                    updatedAt: nowISO(),
                  };
                  await storage.put('contentnode', input.node, updated);
                  return updateOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Remove node from nodes set.
  // Returns notfound if the node does not exist.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contentnode', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentNodeError, ContentNodeDeleteOutput>(
              deleteNotfound(`Node ${input.node} not found`),
            ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('contentnode', input.node);
                  return deleteOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Return the node's type, content, and metadata.
  // Returns notfound if the node does not exist.
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contentnode', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentNodeError, ContentNodeGetOutput>(
              getNotfound(`Node ${input.node} not found`),
            ),
            (found) =>
              TE.right<ContentNodeError, ContentNodeGetOutput>(
                getOk(
                  input.node,
                  asString(found.type),
                  asString(found.content),
                  asString(found.metadata),
                ),
              ),
          ),
        ),
      ),
    ),

  // Store metadata JSON on the node.
  // Returns notfound if the node does not exist.
  setMetadata: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contentnode', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentNodeError, ContentNodeSetMetadataOutput>(
              setMetadataNotfound(`Node ${input.node} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    metadata: input.metadata,
                    updatedAt: nowISO(),
                  };
                  await storage.put('contentnode', input.node, updated);
                  return setMetadataOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Change the node's content type.
  // Returns notfound if the node does not exist.
  changeType: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contentnode', input.node),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentNodeError, ContentNodeChangeTypeOutput>(
              changeTypeNotfound(`Node ${input.node} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    type: input.type,
                    updatedAt: nowISO(),
                  };
                  await storage.put('contentnode', input.node, updated);
                  return changeTypeOk(input.node);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
