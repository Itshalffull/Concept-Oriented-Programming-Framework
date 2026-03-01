// Navigator — route registration, URL pattern matching, navigation history, and guard management.
// Manages a navigation tree with back/forward history stacks and route guards for access control.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NavigatorStorage,
  NavigatorRegisterInput,
  NavigatorRegisterOutput,
  NavigatorGoInput,
  NavigatorGoOutput,
  NavigatorBackInput,
  NavigatorBackOutput,
  NavigatorForwardInput,
  NavigatorForwardOutput,
  NavigatorReplaceInput,
  NavigatorReplaceOutput,
  NavigatorAddGuardInput,
  NavigatorAddGuardOutput,
  NavigatorRemoveGuardInput,
  NavigatorRemoveGuardOutput,
} from './types.js';

import {
  registerOk,
  registerDuplicate,
  goOk,
  goBlocked,
  goNotfound,
  backOk,
  backEmpty,
  forwardOk,
  forwardEmpty,
  replaceOk,
  replaceNotfound,
  addGuardOk,
  addGuardInvalid,
  removeGuardOk,
  removeGuardNotfound,
} from './types.js';

export interface NavigatorError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): NavigatorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface NavigatorHandler {
  readonly register: (
    input: NavigatorRegisterInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorRegisterOutput>;
  readonly go: (
    input: NavigatorGoInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorGoOutput>;
  readonly back: (
    input: NavigatorBackInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorBackOutput>;
  readonly forward: (
    input: NavigatorForwardInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorForwardOutput>;
  readonly replace: (
    input: NavigatorReplaceInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorReplaceOutput>;
  readonly addGuard: (
    input: NavigatorAddGuardInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorAddGuardOutput>;
  readonly removeGuard: (
    input: NavigatorRemoveGuardInput,
    storage: NavigatorStorage,
  ) => TE.TaskEither<NavigatorError, NavigatorRemoveGuardOutput>;
}

// --- Implementation ---

export const navigatorHandler: NavigatorHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('route', input.nav),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('route', input.nav, {
                    nav: input.nav,
                    name: input.name,
                    targetConcept: input.targetConcept,
                    targetView: input.targetView,
                    paramsSchema: pipe(input.paramsSchema, O.getOrElse(() => '')),
                    meta: pipe(input.meta, O.getOrElse(() => '{}')),
                  });
                  return registerOk(input.nav);
                },
                storageErr,
              ),
            () => TE.right(registerDuplicate(`Route '${input.nav}' is already registered`)),
          ),
        ),
      ),
    ),

  go: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('route', input.nav),
        storageErr,
      ),
      TE.chain((route) =>
        pipe(
          O.fromNullable(route),
          O.fold(
            () => TE.right(goNotfound(`Route '${input.nav}' not found`)),
            () =>
              pipe(
                // Check all guards registered on this route
                TE.tryCatch(
                  () => storage.find('guard', { nav: input.nav }),
                  storageErr,
                ),
                TE.chain((guards) => {
                  const blockingGuard = guards.find(
                    (g: Record<string, unknown>) => g.blocking === true,
                  );
                  if (blockingGuard) {
                    return TE.right(
                      goBlocked(input.nav, `Guard '${String(blockingGuard.guard)}' blocked navigation`),
                    );
                  }
                  return TE.tryCatch(
                    async () => {
                      // Capture current location for history
                      const current = await storage.get('state', 'current');
                      const previousNav: O.Option<string> = pipe(
                        O.fromNullable(current),
                        O.map((c: Record<string, unknown>) => String(c.nav)),
                      );

                      // Push current onto back stack
                      if (current !== null) {
                        const backStack = await storage.get('state', 'backStack');
                        const entries: readonly Record<string, unknown>[] =
                          backStack !== null ? (backStack as any).entries ?? [] : [];
                        await storage.put('state', 'backStack', {
                          entries: [...entries, current],
                        });
                      }

                      // Clear forward stack on new navigation
                      await storage.put('state', 'forwardStack', { entries: [] });

                      // Set the new current location
                      await storage.put('state', 'current', {
                        nav: input.nav,
                        params: pipe(input.params, O.getOrElse(() => '{}')),
                      });

                      return goOk(input.nav, previousNav);
                    },
                    storageErr,
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  back: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('state', 'backStack'),
        storageErr,
      ),
      TE.chain((backStack) => {
        const entries: readonly Record<string, unknown>[] =
          backStack !== null ? (backStack as any).entries ?? [] : [];
        if (entries.length === 0) {
          return TE.right(backEmpty('Navigation history is empty'));
        }
        return TE.tryCatch(
          async () => {
            const previous = entries[entries.length - 1];
            const remaining = entries.slice(0, entries.length - 1);

            // Push current onto forward stack
            const current = await storage.get('state', 'current');
            if (current !== null) {
              const fwdStack = await storage.get('state', 'forwardStack');
              const fwdEntries: readonly Record<string, unknown>[] =
                fwdStack !== null ? (fwdStack as any).entries ?? [] : [];
              await storage.put('state', 'forwardStack', {
                entries: [...fwdEntries, current],
              });
            }

            await storage.put('state', 'backStack', { entries: remaining });
            await storage.put('state', 'current', previous);

            return backOk(String(previous.nav), input.nav);
          },
          storageErr,
        );
      }),
    ),

  forward: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('state', 'forwardStack'),
        storageErr,
      ),
      TE.chain((forwardStack) => {
        const entries: readonly Record<string, unknown>[] =
          forwardStack !== null ? (forwardStack as any).entries ?? [] : [];
        if (entries.length === 0) {
          return TE.right(forwardEmpty('No forward history available'));
        }
        return TE.tryCatch(
          async () => {
            const next = entries[entries.length - 1];
            const remaining = entries.slice(0, entries.length - 1);

            // Push current onto back stack
            const current = await storage.get('state', 'current');
            if (current !== null) {
              const bkStack = await storage.get('state', 'backStack');
              const bkEntries: readonly Record<string, unknown>[] =
                bkStack !== null ? (bkStack as any).entries ?? [] : [];
              await storage.put('state', 'backStack', {
                entries: [...bkEntries, current],
              });
            }

            await storage.put('state', 'forwardStack', { entries: remaining });
            await storage.put('state', 'current', next);

            return forwardOk(String(next.nav), input.nav);
          },
          storageErr,
        );
      }),
    ),

  replace: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('route', input.nav),
        storageErr,
      ),
      TE.chain((route) =>
        pipe(
          O.fromNullable(route),
          O.fold(
            () => TE.right(replaceNotfound(`Route '${input.nav}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  // Replace swaps current without touching history stacks
                  const current = await storage.get('state', 'current');
                  const previousNav: O.Option<string> = pipe(
                    O.fromNullable(current),
                    O.map((c: Record<string, unknown>) => String(c.nav)),
                  );

                  await storage.put('state', 'current', {
                    nav: input.nav,
                    params: pipe(input.params, O.getOrElse(() => '{}')),
                  });

                  return replaceOk(input.nav, previousNav);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  addGuard: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('route', input.nav),
        storageErr,
      ),
      TE.chain((route) =>
        pipe(
          O.fromNullable(route),
          O.fold(
            () => TE.right(addGuardInvalid(`Route '${input.nav}' does not exist`)),
            () =>
              TE.tryCatch(
                async () => {
                  const guardKey = `${input.nav}::${input.guard}`;
                  await storage.put('guard', guardKey, {
                    nav: input.nav,
                    guard: input.guard,
                    blocking: true,
                  });
                  return addGuardOk(input.nav);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  removeGuard: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('guard', `${input.nav}::${input.guard}`),
        storageErr,
      ),
      TE.chain((guard) =>
        pipe(
          O.fromNullable(guard),
          O.fold(
            () =>
              TE.right(
                removeGuardNotfound(`Guard '${input.guard}' not found on route '${input.nav}'`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('guard', `${input.nav}::${input.guard}`);
                  return removeGuardOk(input.nav);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),
};
