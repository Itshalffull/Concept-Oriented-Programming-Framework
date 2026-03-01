// Intent — handler.ts
// Concept intent recognition: define purpose-driven intents for concepts, verify alignment,
// and discover intents by keyword matching against stored definitions.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  IntentStorage,
  IntentDefineInput,
  IntentDefineOutput,
  IntentUpdateInput,
  IntentUpdateOutput,
  IntentVerifyInput,
  IntentVerifyOutput,
  IntentDiscoverInput,
  IntentDiscoverOutput,
  IntentSuggestFromDescriptionInput,
  IntentSuggestFromDescriptionOutput,
} from './types.js';

import {
  defineOk,
  defineExists,
  updateOk,
  updateNotfound,
  verifyOk,
  verifyNotfound,
  discoverOk,
  suggestFromDescriptionOk,
} from './types.js';

export interface IntentError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): IntentError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface IntentHandler {
  readonly define: (
    input: IntentDefineInput,
    storage: IntentStorage,
  ) => TE.TaskEither<IntentError, IntentDefineOutput>;
  readonly update: (
    input: IntentUpdateInput,
    storage: IntentStorage,
  ) => TE.TaskEither<IntentError, IntentUpdateOutput>;
  readonly verify: (
    input: IntentVerifyInput,
    storage: IntentStorage,
  ) => TE.TaskEither<IntentError, IntentVerifyOutput>;
  readonly discover: (
    input: IntentDiscoverInput,
    storage: IntentStorage,
  ) => TE.TaskEither<IntentError, IntentDiscoverOutput>;
  readonly suggestFromDescription: (
    input: IntentSuggestFromDescriptionInput,
    storage: IntentStorage,
  ) => TE.TaskEither<IntentError, IntentSuggestFromDescriptionOutput>;
}

// --- Implementation ---

export const intentHandler: IntentHandler = {
  // Register a new intent; reject if already defined for the same name
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('intent', input.intent),
        toError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('intent', input.intent, {
                    intent: input.intent,
                    target: input.target,
                    purpose: input.purpose,
                    operationalPrinciple: input.operationalPrinciple,
                    createdAt: new Date().toISOString(),
                  });
                  return defineOk(input.intent);
                },
                toError,
              ),
            () => TE.right(defineExists(`Intent '${input.intent}' already exists`)),
          ),
        ),
      ),
    ),

  // Update an existing intent's purpose and operational principle
  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('intent', input.intent),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(updateNotfound(`Intent '${input.intent}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('intent', input.intent, {
                    ...found,
                    purpose: input.purpose,
                    operationalPrinciple: input.operationalPrinciple,
                    updatedAt: new Date().toISOString(),
                  });
                  return updateOk(input.intent);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Verify an intent definition has required fields (purpose, operationalPrinciple, target)
  verify: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('intent', input.intent),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(verifyNotfound(`Intent '${input.intent}' not found`)),
            (found) => {
              const failures: readonly string[] = [
                ...(found.purpose ? [] : ['Missing purpose']),
                ...(found.operationalPrinciple ? [] : ['Missing operationalPrinciple']),
                ...(found.target ? [] : ['Missing target']),
              ];
              const valid = failures.length === 0;
              return TE.right(verifyOk(valid, JSON.stringify(failures)));
            },
          ),
        ),
      ),
    ),

  // Discover intents matching a query string against purpose and target fields
  discover: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('intent');
          const query = input.query.toLowerCase();
          const matches = all.filter((rec) => {
            const purpose = ((rec.purpose as string) ?? '').toLowerCase();
            const target = ((rec.target as string) ?? '').toLowerCase();
            const name = ((rec.intent as string) ?? '').toLowerCase();
            return purpose.includes(query) || target.includes(query) || name.includes(query);
          });
          return discoverOk(
            JSON.stringify(matches.map((m) => ({ intent: m.intent, purpose: m.purpose }))),
          );
        },
        toError,
      ),
    ),

  // Extract keywords from a free-text description and suggest matching intents
  suggestFromDescription: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('intent');
          const words = input.description.toLowerCase().split(/\s+/);
          const scored = all.map((rec) => {
            const purpose = ((rec.purpose as string) ?? '').toLowerCase();
            const target = ((rec.target as string) ?? '').toLowerCase();
            const score = words.reduce(
              (acc, w) => acc + (purpose.includes(w) ? 1 : 0) + (target.includes(w) ? 1 : 0),
              0,
            );
            return { intent: rec.intent as string, score };
          });
          const relevant = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
          return suggestFromDescriptionOk(
            JSON.stringify(relevant.map((r) => r.intent)),
          );
        },
        toError,
      ),
    ),
};
