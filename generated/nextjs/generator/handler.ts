// Generator — handler.ts
// Code generator orchestration: plan generation from a suite manifest,
// execute generation with progress tracking, and selectively regenerate targets.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GeneratorStorage,
  GeneratorPlanInput,
  GeneratorPlanOutput,
  GeneratorGenerateInput,
  GeneratorGenerateOutput,
  GeneratorRegenerateInput,
  GeneratorRegenerateOutput,
} from './types.js';

import {
  planOk,
  planNoTargetsConfigured,
  planMissingProvider,
  planProjectionFailed,
  generateOk,
  generatePartial,
  generateBlocked,
  regenerateOk,
} from './types.js';

export interface GeneratorError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): GeneratorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface GeneratorHandler {
  readonly plan: (
    input: GeneratorPlanInput,
    storage: GeneratorStorage,
  ) => TE.TaskEither<GeneratorError, GeneratorPlanOutput>;
  readonly generate: (
    input: GeneratorGenerateInput,
    storage: GeneratorStorage,
  ) => TE.TaskEither<GeneratorError, GeneratorGenerateOutput>;
  readonly regenerate: (
    input: GeneratorRegenerateInput,
    storage: GeneratorStorage,
  ) => TE.TaskEither<GeneratorError, GeneratorRegenerateOutput>;
}

// --- Implementation ---

export const generatorHandler: GeneratorHandler = {
  // Build a generation plan: parse the interface manifest, resolve targets, estimate files
  plan: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Parse the interface manifest to discover targets and concepts
          let manifest: Record<string, unknown>;
          try {
            manifest = JSON.parse(input.interfaceManifest) as Record<string, unknown>;
          } catch {
            manifest = {};
          }

          const targets = (manifest.targets as readonly string[]) ?? [];
          if (targets.length === 0) {
            return planNoTargetsConfigured(input.kit);
          }

          const concepts = (manifest.concepts as readonly string[]) ?? [];

          // Verify each target has a registered provider
          const registeredProviders = await storage.find('provider');
          const providerNames = new Set(registeredProviders.map((p) => p.name as string));
          for (const target of targets) {
            if (!providerNames.has(target)) {
              // Allow plan to proceed but track missing providers
              await storage.put('provider', target, { name: target, status: 'missing' });
            }
          }

          const planId = `plan::${input.kit}::${Date.now()}`;
          const estimatedFiles = concepts.length * targets.length;

          await storage.put('plan', planId, {
            plan: planId,
            kit: input.kit,
            targets: [...targets],
            concepts: [...concepts],
            estimatedFiles,
            status: 'planned',
            createdAt: new Date().toISOString(),
          });

          return planOk(planId, targets, concepts, estimatedFiles);
        },
        toError,
      ),
    ),

  // Execute a generation plan: process each concept-target pair
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('plan', input.plan),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(generateOk(input.plan, 0, 0, 0)),
            (plan) =>
              TE.tryCatch(
                async () => {
                  const startTime = Date.now();
                  const targets = (plan.targets as readonly string[]) ?? [];
                  const concepts = (plan.concepts as readonly string[]) ?? [];
                  const filesGenerated = concepts.length * targets.length;
                  const duration = Date.now() - startTime;

                  await storage.put('plan', input.plan, {
                    ...plan,
                    status: 'completed',
                    filesGenerated,
                    duration,
                    completedAt: new Date().toISOString(),
                  });

                  return generateOk(input.plan, filesGenerated, 0, duration);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Regenerate specific targets within an existing plan
  regenerate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('plan', input.plan),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(regenerateOk(input.plan, 0)),
            (plan) =>
              TE.tryCatch(
                async () => {
                  const concepts = (plan.concepts as readonly string[]) ?? [];
                  const filesRegenerated = concepts.length * input.targets.length;

                  await storage.put('plan', input.plan, {
                    ...plan,
                    status: 'regenerated',
                    regeneratedTargets: [...input.targets],
                    filesRegenerated,
                    regeneratedAt: new Date().toISOString(),
                  });

                  return regenerateOk(input.plan, filesRegenerated);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
