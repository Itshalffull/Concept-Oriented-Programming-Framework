// VersionContext — Per-user version space stack tracking.
// All storage operations resolve through the correct overlay chain based on the user's
// active version context.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VersionContextStorage,
  VersionContextPushInput,
  VersionContextPushOutput,
  VersionContextPopInput,
  VersionContextPopOutput,
  VersionContextGetInput,
  VersionContextGetOutput,
  VersionContextResolveForInput,
  VersionContextResolveForOutput,
} from './types.js';

import {
  pushOk,
  popOk,
  getOk,
  getNoContext,
  resolveForOk,
} from './types.js';

export interface VersionContextError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): VersionContextError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
const nextId = (): string => `vctx-${++idCounter}`;

export interface VersionContextHandler {
  readonly push: (
    input: VersionContextPushInput,
    storage: VersionContextStorage,
  ) => TE.TaskEither<VersionContextError, VersionContextPushOutput>;
  readonly pop: (
    input: VersionContextPopInput,
    storage: VersionContextStorage,
  ) => TE.TaskEither<VersionContextError, VersionContextPopOutput>;
  readonly get: (
    input: VersionContextGetInput,
    storage: VersionContextStorage,
  ) => TE.TaskEither<VersionContextError, VersionContextGetOutput>;
  readonly resolveFor: (
    input: VersionContextResolveForInput,
    storage: VersionContextStorage,
  ) => TE.TaskEither<VersionContextError, VersionContextResolveForOutput>;
}

// --- Implementation ---

export const versionContextHandler: VersionContextHandler = {
  push: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('contexts', { context_user: input.user }),
        toStorageError,
      ),
      TE.chain((existing) => {
        if (existing.length > 0) {
          const ctx = existing[0];
          const stack: string[] = Array.isArray(ctx['context_stack'])
            ? [...(ctx['context_stack'] as string[])]
            : ctx['context_stack']
              ? JSON.parse(String(ctx['context_stack']))
              : [];

          stack.push(input.space_id);
          const now = new Date().toISOString();

          return TE.tryCatch(
            async () => {
              await storage.put('contexts', String(ctx['id']), {
                ...ctx,
                context_stack: stack,
                context_updated_at: now,
              });
              return pushOk(String(ctx['id']));
            },
            toStorageError,
          );
        }

        // Create new context
        const id = nextId();
        const now = new Date().toISOString();
        return TE.tryCatch(
          async () => {
            await storage.put('contexts', id, {
              id,
              context_user: input.user,
              context_stack: [input.space_id],
              context_updated_at: now,
            });
            return pushOk(id);
          },
          toStorageError,
        );
      }),
    ),

  pop: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('contexts', { context_user: input.user }),
        toStorageError,
      ),
      TE.chain((existing) => {
        if (existing.length === 0) {
          const id = nextId();
          return TE.right(popOk(id));
        }

        const ctx = existing[0];
        const rawStack: string[] = Array.isArray(ctx['context_stack'])
          ? [...(ctx['context_stack'] as string[])]
          : ctx['context_stack']
            ? JSON.parse(String(ctx['context_stack']))
            : [];

        // Remove the space and all sub-spaces above it
        const idx = rawStack.indexOf(input.space_id);
        const stack = idx >= 0 ? rawStack.slice(0, idx) : rawStack;
        const now = new Date().toISOString();

        if (stack.length === 0) {
          return TE.tryCatch(
            async () => {
              await storage.delete('contexts', String(ctx['id']));
              return popOk(String(ctx['id']));
            },
            toStorageError,
          );
        }

        return TE.tryCatch(
          async () => {
            await storage.put('contexts', String(ctx['id']), {
              ...ctx,
              context_stack: stack,
              context_updated_at: now,
            });
            return popOk(String(ctx['id']));
          },
          toStorageError,
        );
      }),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('contexts', { context_user: input.user }),
        toStorageError,
      ),
      TE.map((existing) => {
        if (existing.length === 0) {
          return getNoContext(input.user);
        }
        const ctx = existing[0];
        const stack: readonly string[] = Array.isArray(ctx['context_stack'])
          ? (ctx['context_stack'] as string[])
          : ctx['context_stack']
            ? JSON.parse(String(ctx['context_stack']))
            : [];
        return getOk(stack);
      }),
    ),

  resolveFor: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('contexts', { context_user: input.user }),
        toStorageError,
      ),
      TE.map((existing) => {
        if (existing.length === 0) {
          return resolveForOk('{}', 'base');
        }

        const ctx = existing[0];
        const stack: string[] = Array.isArray(ctx['context_stack'])
          ? (ctx['context_stack'] as string[])
          : ctx['context_stack']
            ? JSON.parse(String(ctx['context_stack']))
            : [];

        if (stack.length === 0) {
          return resolveForOk('{}', 'base');
        }

        // Walk the stack from most specific to least specific.
        // In a full implementation, this delegates to VersionSpace/resolve
        // for each space in the stack. Here we return the innermost space
        // as the source, signaling that resolution should happen there.
        const innermostSpace = stack[stack.length - 1];
        return resolveForOk('{}', innermostSpace);
      }),
    ),
};
