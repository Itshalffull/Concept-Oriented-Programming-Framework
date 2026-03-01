// Binding — handler.ts
// Variable binding with lexical scoping: create bindings between concepts,
// synchronize state, invoke bound actions, and unbind with cleanup.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  BindingStorage,
  BindingBindInput,
  BindingBindOutput,
  BindingSyncInput,
  BindingSyncOutput,
  BindingInvokeInput,
  BindingInvokeOutput,
  BindingUnbindInput,
  BindingUnbindOutput,
} from './types.js';

import {
  bindOk,
  bindInvalid,
  syncOk,
  syncError,
  invokeOk,
  invokeError,
  unbindOk,
  unbindNotfound,
} from './types.js';

export interface BindingError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): BindingError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Allowed binding modes
const VALID_MODES: ReadonlySet<string> = new Set(['one-way', 'two-way', 'lazy', 'eager']);

export interface BindingHandler {
  readonly bind: (
    input: BindingBindInput,
    storage: BindingStorage,
  ) => TE.TaskEither<BindingError, BindingBindOutput>;
  readonly sync: (
    input: BindingSyncInput,
    storage: BindingStorage,
  ) => TE.TaskEither<BindingError, BindingSyncOutput>;
  readonly invoke: (
    input: BindingInvokeInput,
    storage: BindingStorage,
  ) => TE.TaskEither<BindingError, BindingInvokeOutput>;
  readonly unbind: (
    input: BindingUnbindInput,
    storage: BindingStorage,
  ) => TE.TaskEither<BindingError, BindingUnbindOutput>;
}

// --- Implementation ---

export const bindingHandler: BindingHandler = {
  // Create a new binding between the given name and concept; validate mode
  bind: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!VALID_MODES.has(input.mode)) {
            return bindInvalid(`Invalid binding mode '${input.mode}'. Must be one of: ${[...VALID_MODES].join(', ')}`);
          }
          await storage.put('binding', input.binding, {
            binding: input.binding,
            concept: input.concept,
            mode: input.mode,
            state: 'active',
            createdAt: new Date().toISOString(),
          });
          return bindOk(input.binding);
        },
        toError,
      ),
    ),

  // Synchronize a binding's state; the binding must exist and be active
  sync: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('binding', input.binding),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(syncError(`Binding '${input.binding}' not found`)),
            (found) => {
              if (found.state === 'unbound') {
                return TE.right(syncError(`Binding '${input.binding}' has been unbound`));
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('binding', input.binding, {
                    ...found,
                    lastSyncedAt: new Date().toISOString(),
                  });
                  return syncOk(input.binding);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  // Invoke an action through a binding, delegating to the bound concept
  invoke: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('binding', input.binding),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(invokeError(`Binding '${input.binding}' not found`)),
            (found) => {
              if (found.state === 'unbound') {
                return TE.right(invokeError(`Binding '${input.binding}' is unbound; cannot invoke`));
              }
              return TE.tryCatch(
                async () => {
                  // Record the invocation in the binding's action log
                  const concept = found.concept as string;
                  const result = JSON.stringify({
                    concept,
                    action: input.action,
                    input: input.input,
                    invokedAt: new Date().toISOString(),
                  });
                  await storage.put('binding', input.binding, {
                    ...found,
                    lastAction: input.action,
                    lastInvokedAt: new Date().toISOString(),
                  });
                  return invokeOk(input.binding, result);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  // Unbind: mark the binding as unbound; it must exist
  unbind: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('binding', input.binding),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(unbindNotfound(`Binding '${input.binding}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('binding', input.binding, {
                    ...found,
                    state: 'unbound',
                    unboundAt: new Date().toISOString(),
                  });
                  return unbindOk(input.binding);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
