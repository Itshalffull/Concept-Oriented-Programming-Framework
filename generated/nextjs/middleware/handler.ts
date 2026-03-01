// Middleware — Middleware pipeline resolution, registration, and injection
// Registers trait-based middleware implementations with position ordering,
// resolves middleware chains for a target, detects incompatibilities,
// and injects resolved middleware into output artifacts.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MiddlewareStorage,
  MiddlewareResolveInput,
  MiddlewareResolveOutput,
  MiddlewareInjectInput,
  MiddlewareInjectOutput,
  MiddlewareRegisterInput,
  MiddlewareRegisterOutput,
} from './types.js';

import {
  resolveOk,
  resolveMissingImplementation,
  resolveIncompatibleTraits,
  injectOk,
  registerOk,
  registerDuplicateRegistration,
} from './types.js';

export interface MiddlewareError {
  readonly code: string;
  readonly message: string;
}

export interface MiddlewareHandler {
  readonly resolve: (
    input: MiddlewareResolveInput,
    storage: MiddlewareStorage,
  ) => TE.TaskEither<MiddlewareError, MiddlewareResolveOutput>;
  readonly inject: (
    input: MiddlewareInjectInput,
    storage: MiddlewareStorage,
  ) => TE.TaskEither<MiddlewareError, MiddlewareInjectOutput>;
  readonly register: (
    input: MiddlewareRegisterInput,
    storage: MiddlewareStorage,
  ) => TE.TaskEither<MiddlewareError, MiddlewareRegisterOutput>;
}

const storageError = (error: unknown): MiddlewareError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Build a composite key for middleware registration
const registrationKey = (trait: string, target: string): string =>
  `${trait}::${target}`;

// Known incompatible trait pairs (bidirectional)
const INCOMPATIBLE_PAIRS: readonly [string, string][] = [
  ['cache', 'no-cache'],
  ['compress', 'raw'],
  ['auth-required', 'public-only'],
];

// Parse the position field into a numeric ordering value
const parsePosition = (position: string): number => {
  const lowerPos = position.toLowerCase();
  if (lowerPos === 'before' || lowerPos === 'first') return 0;
  if (lowerPos === 'after' || lowerPos === 'last') return 999;
  const num = parseInt(position, 10);
  return isNaN(num) ? 500 : num;
};

// --- Implementation ---

export const middlewareHandler: MiddlewareHandler = {
  // Resolve a middleware chain for the given traits and target. Looks up
  // registered implementations for each trait, checks for incompatible
  // trait combinations, and returns the ordered middleware list.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const middlewares: string[] = [];
          const orders: number[] = [];

          // Check for incompatible trait pairs
          for (const [a, b] of INCOMPATIBLE_PAIRS) {
            if (input.traits.includes(a) && input.traits.includes(b)) {
              return resolveIncompatibleTraits(a, b, `Traits '${a}' and '${b}' cannot coexist in a middleware pipeline`);
            }
          }

          // Look up implementations for each requested trait
          for (const trait of input.traits) {
            const key = registrationKey(trait, input.target);
            const record = await storage.get('middleware_registrations', key);

            if (!record) {
              return resolveMissingImplementation(trait, input.target);
            }

            const data = record as Record<string, unknown>;
            const implementation = String(data.implementation ?? '');
            const position = String(data.position ?? 'last');

            middlewares.push(implementation);
            orders.push(parsePosition(position));
          }

          // Sort middlewares by their position ordering
          const indexed = middlewares.map((mw, i) => ({ mw, order: orders[i] }));
          indexed.sort((a, b) => a.order - b.order);

          return resolveOk(
            indexed.map((item) => item.mw),
            indexed.map((item) => item.order),
          );
        },
        storageError,
      ),
    ),

  // Inject resolved middleware references into an output artifact.
  // Inserts middleware invocation markers into the output string.
  inject: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          let output = input.output;
          let injectedCount = 0;

          for (const mw of input.middlewares) {
            // Insert middleware call at the appropriate point in the output
            const marker = `/* middleware:${mw} */`;
            output = `${marker}\n${output}`;
            injectedCount += 1;
          }

          // Store the injection result for auditing
          await storage.put('middleware_injections', `${input.target}::${new Date().toISOString()}`, {
            target: input.target,
            middlewares: input.middlewares,
            injectedCount,
            injectedAt: new Date().toISOString(),
          });

          return injectOk(output, injectedCount);
        },
        storageError,
      ),
    ),

  // Register a middleware implementation for a trait and target.
  // Prevents duplicate registrations of the same trait+target combination.
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('middleware_registrations', registrationKey(input.trait, input.target)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const middlewareId = `${input.trait}:${input.target}:${input.implementation}`;
                  await storage.put('middleware_registrations', registrationKey(input.trait, input.target), {
                    trait: input.trait,
                    target: input.target,
                    implementation: input.implementation,
                    position: input.position,
                    middlewareId,
                    registeredAt: new Date().toISOString(),
                  });
                  return registerOk(middlewareId);
                },
                storageError,
              ),
            () =>
              TE.right(registerDuplicateRegistration(input.trait, input.target)),
          ),
        ),
      ),
    ),
};
