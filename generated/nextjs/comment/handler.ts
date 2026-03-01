// Comment — handler.ts
// Threaded discussion attached polymorphically to any content entity
// using materialized path threading.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CommentStorage,
  CommentAddCommentInput,
  CommentAddCommentOutput,
  CommentReplyInput,
  CommentReplyOutput,
  CommentPublishInput,
  CommentPublishOutput,
  CommentUnpublishInput,
  CommentUnpublishOutput,
  CommentDeleteInput,
  CommentDeleteOutput,
} from './types.js';

import {
  addCommentOk,
  replyOk,
  publishOk,
  publishNotfound,
  unpublishOk,
  unpublishNotfound,
  deleteOk,
  deleteNotfound,
} from './types.js';

export interface CommentError {
  readonly code: string;
  readonly message: string;
}

export interface CommentHandler {
  readonly addComment: (
    input: CommentAddCommentInput,
    storage: CommentStorage,
  ) => TE.TaskEither<CommentError, CommentAddCommentOutput>;
  readonly reply: (
    input: CommentReplyInput,
    storage: CommentStorage,
  ) => TE.TaskEither<CommentError, CommentReplyOutput>;
  readonly publish: (
    input: CommentPublishInput,
    storage: CommentStorage,
  ) => TE.TaskEither<CommentError, CommentPublishOutput>;
  readonly unpublish: (
    input: CommentUnpublishInput,
    storage: CommentStorage,
  ) => TE.TaskEither<CommentError, CommentUnpublishOutput>;
  readonly delete: (
    input: CommentDeleteInput,
    storage: CommentStorage,
  ) => TE.TaskEither<CommentError, CommentDeleteOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): CommentError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const buildThreadPath = (parentPath: string, commentId: string): string =>
  parentPath === '' ? commentId : `${parentPath}/${commentId}`;

const nowISO = (): string => new Date().toISOString();

// --- Implementation ---

export const commentHandler: CommentHandler = {
  // Attaches a new top-level comment to the specified entity.
  // Stores with materialized thread path for efficient threaded queries.
  addComment: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record: Record<string, unknown> = {
            id: input.comment,
            entity: input.entity,
            content: input.content,
            author: input.author,
            parent: null,
            threadPath: input.comment,
            published: true,
            deleted: false,
            createdAt: nowISO(),
            updatedAt: nowISO(),
          };
          await storage.put('comment', input.comment, record);
          return addCommentOk(input.comment);
        },
        storageError,
      ),
    ),

  // Creates a threaded reply under the given parent comment,
  // extending the materialized thread path. Verifies parent exists.
  reply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('comment', input.parent),
        storageError,
      ),
      TE.chain((parentRecord) =>
        pipe(
          O.fromNullable(parentRecord),
          O.fold(
            () =>
              TE.left<CommentError>({
                code: 'PARENT_NOT_FOUND',
                message: `Parent comment ${input.parent} does not exist`,
              }),
            (parent) => {
              const parentPath = typeof parent.threadPath === 'string'
                ? parent.threadPath
                : input.parent;
              const parentDeleted = parent.deleted === true;
              if (parentDeleted) {
                return TE.left<CommentError>({
                  code: 'PARENT_DELETED',
                  message: `Cannot reply to deleted comment ${input.parent}`,
                });
              }
              return TE.tryCatch(
                async () => {
                  const threadPath = buildThreadPath(parentPath, input.comment);
                  const record: Record<string, unknown> = {
                    id: input.comment,
                    entity: parent.entity,
                    content: input.content,
                    author: input.author,
                    parent: input.parent,
                    threadPath,
                    published: true,
                    deleted: false,
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  };
                  await storage.put('comment', input.comment, record);
                  return replyOk(input.comment);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Makes the comment visible. Returns notfound if comment does not exist.
  publish: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('comment', input.comment),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CommentError, CommentPublishOutput>(
              publishNotfound(`Comment ${input.comment} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    published: true,
                    updatedAt: nowISO(),
                  };
                  await storage.put('comment', input.comment, updated);
                  return publishOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Hides the comment from public view. Returns notfound if comment does not exist.
  unpublish: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('comment', input.comment),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CommentError, CommentUnpublishOutput>(
              unpublishNotfound(`Comment ${input.comment} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    published: false,
                    updatedAt: nowISO(),
                  };
                  await storage.put('comment', input.comment, updated);
                  return unpublishOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Soft deletes the comment and cascades to all replies sharing
  // the same thread path prefix.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('comment', input.comment),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CommentError, CommentDeleteOutput>(
              deleteNotfound(`Comment ${input.comment} not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const threadPath = typeof existing.threadPath === 'string'
                    ? existing.threadPath
                    : input.comment;

                  // Soft-delete the comment itself
                  const updated = {
                    ...existing,
                    deleted: true,
                    content: '[deleted]',
                    updatedAt: nowISO(),
                  };
                  await storage.put('comment', input.comment, updated);

                  // Cascade soft-delete to all replies under this thread path
                  const allComments = await storage.find('comment');
                  const replies = allComments.filter((c) => {
                    const path = typeof c.threadPath === 'string' ? c.threadPath : '';
                    return path.startsWith(threadPath + '/') && c.deleted !== true;
                  });
                  for (const reply of replies) {
                    const replyId = typeof reply.id === 'string' ? reply.id : '';
                    if (replyId !== '') {
                      await storage.put('comment', replyId, {
                        ...reply,
                        deleted: true,
                        content: '[deleted]',
                        updatedAt: nowISO(),
                      });
                    }
                  }

                  return deleteOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
