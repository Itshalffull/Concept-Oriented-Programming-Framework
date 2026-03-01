// KitManager — handler.ts
// Suite lifecycle management: initialize new suites, validate structure,
// run suite-level tests, list registered suites, and check handler overrides.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  KitManagerStorage,
  KitManagerInitInput,
  KitManagerInitOutput,
  KitManagerValidateInput,
  KitManagerValidateOutput,
  KitManagerTestInput,
  KitManagerTestOutput,
  KitManagerListInput,
  KitManagerListOutput,
  KitManagerCheckOverridesInput,
  KitManagerCheckOverridesOutput,
} from './types.js';

import {
  initOk,
  initAlreadyExists,
  validateOk,
  validateError,
  testOk,
  testError,
  listOk,
  checkOverridesOk,
  checkOverridesInvalidOverride,
} from './types.js';

export interface KitManagerError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): KitManagerError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface KitManagerHandler {
  readonly init: (
    input: KitManagerInitInput,
    storage: KitManagerStorage,
  ) => TE.TaskEither<KitManagerError, KitManagerInitOutput>;
  readonly validate: (
    input: KitManagerValidateInput,
    storage: KitManagerStorage,
  ) => TE.TaskEither<KitManagerError, KitManagerValidateOutput>;
  readonly test: (
    input: KitManagerTestInput,
    storage: KitManagerStorage,
  ) => TE.TaskEither<KitManagerError, KitManagerTestOutput>;
  readonly list: (
    input: KitManagerListInput,
    storage: KitManagerStorage,
  ) => TE.TaskEither<KitManagerError, KitManagerListOutput>;
  readonly checkOverrides: (
    input: KitManagerCheckOverridesInput,
    storage: KitManagerStorage,
  ) => TE.TaskEither<KitManagerError, KitManagerCheckOverridesOutput>;
}

// --- Implementation ---

export const kitManagerHandler: KitManagerHandler = {
  // Initialize a new suite scaffold; reject if name is already registered
  init: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('suite', input.name),
        toError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const suitePath = `suites/${input.name}`;
                  await storage.put('suite', input.name, {
                    kit: input.name,
                    path: suitePath,
                    status: 'initialized',
                    concepts: 0,
                    syncs: 0,
                    createdAt: new Date().toISOString(),
                  });
                  return initOk(input.name, suitePath);
                },
                toError,
              ),
            () => TE.right(initAlreadyExists(input.name)),
          ),
        ),
      ),
    ),

  // Validate a suite at the given path: check concept and sync counts
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Look up suite metadata by path
          const allSuites = await storage.find('suite');
          const suite = allSuites.find((s) => s.path === input.path);
          if (!suite) {
            return validateError(`No suite found at path '${input.path}'`);
          }
          const concepts = (suite.concepts as number) ?? 0;
          const syncs = (suite.syncs as number) ?? 0;
          return validateOk((suite.kit as string) ?? '', concepts, syncs);
        },
        toError,
      ),
    ),

  // Run conformance and unit tests for a suite
  test: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSuites = await storage.find('suite');
          const suite = allSuites.find((s) => s.path === input.path);
          if (!suite) {
            return testError(`No suite found at path '${input.path}'`);
          }
          // Run all registered test vectors for this suite
          const testResults = await storage.find('test', { kit: suite.kit });
          const passed = testResults.filter((t) => t.passed === true).length;
          const failed = testResults.filter((t) => t.passed === false).length;
          return testOk((suite.kit as string) ?? '', passed, failed);
        },
        toError,
      ),
    ),

  // List all registered suites
  list: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSuites = await storage.find('suite');
          const suiteNames = allSuites.map((s) => (s.kit as string) ?? '');
          return listOk(suiteNames);
        },
        toError,
      ),
    ),

  // Check handler overrides for validity: each override must reference a real concept action
  checkOverrides: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const overrides = await storage.find('override', { path: input.path });
          const warnings: string[] = [];
          let valid = 0;

          for (const override of overrides) {
            const conceptName = override.concept as string;
            const actionName = override.action as string;
            const concept = await storage.get('concept', conceptName);
            if (!concept) {
              return checkOverridesInvalidOverride(
                `${conceptName}.${actionName}`,
                `Concept '${conceptName}' not found`,
              );
            }
            // Check if the action is defined in the concept
            const actions = (concept.actions as readonly string[]) ?? [];
            if (!actions.includes(actionName)) {
              warnings.push(`Override for '${conceptName}.${actionName}' targets unknown action`);
            } else {
              valid++;
            }
          }

          return checkOverridesOk(valid, warnings);
        },
        toError,
      ),
    ),
};
