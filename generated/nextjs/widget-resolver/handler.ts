// WidgetResolver — handler.ts
// Surface concept: resolves widget references to concrete implementations.
// Walks the resolution chain (aliases, overrides), scores candidates,
// and caches resolved widgets for subsequent lookups.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetResolverStorage,
  WidgetResolverResolveInput,
  WidgetResolverResolveOutput,
  WidgetResolverResolveAllInput,
  WidgetResolverResolveAllOutput,
  WidgetResolverOverrideInput,
  WidgetResolverOverrideOutput,
  WidgetResolverSetWeightsInput,
  WidgetResolverSetWeightsOutput,
  WidgetResolverExplainInput,
  WidgetResolverExplainOutput,
} from './types.js';

import {
  resolveOk,
  resolveAmbiguous,
  resolveNone,
  resolveAllOk,
  resolveAllPartial,
  overrideOk,
  overrideInvalid,
  setWeightsOk,
  setWeightsInvalid,
  explainOk,
  explainNotfound,
} from './types.js';

export interface WidgetResolverError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetResolverHandler {
  readonly resolve: (
    input: WidgetResolverResolveInput,
    storage: WidgetResolverStorage,
  ) => TE.TaskEither<WidgetResolverError, WidgetResolverResolveOutput>;
  readonly resolveAll: (
    input: WidgetResolverResolveAllInput,
    storage: WidgetResolverStorage,
  ) => TE.TaskEither<WidgetResolverError, WidgetResolverResolveAllOutput>;
  readonly override: (
    input: WidgetResolverOverrideInput,
    storage: WidgetResolverStorage,
  ) => TE.TaskEither<WidgetResolverError, WidgetResolverOverrideOutput>;
  readonly setWeights: (
    input: WidgetResolverSetWeightsInput,
    storage: WidgetResolverStorage,
  ) => TE.TaskEither<WidgetResolverError, WidgetResolverSetWeightsOutput>;
  readonly explain: (
    input: WidgetResolverExplainInput,
    storage: WidgetResolverStorage,
  ) => TE.TaskEither<WidgetResolverError, WidgetResolverExplainOutput>;
}

// --- Domain helpers ---

interface CandidateRecord {
  readonly widget: string;
  readonly element: string;
  readonly score: number;
  readonly reason: string;
}

const mkStorageError = (error: unknown): WidgetResolverError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const AMBIGUITY_THRESHOLD = 0.1;

const scoreCandidates = (
  candidates: readonly Record<string, unknown>[],
  weights: Record<string, unknown> | null,
): readonly CandidateRecord[] => {
  const weightMap: Record<string, number> = weights
    ? Object.fromEntries(
        Object.entries(weights).filter(([k]) => k !== 'resolver').map(([k, v]) => [k, Number(v) || 1]),
      )
    : {};

  return candidates.map((c) => {
    const baseScore = Number(c['score'] ?? 0.5);
    const contextBonus = Number(c['contextMatch'] ?? 0);
    const weightMultiplier = weightMap[String(c['widget'] ?? '')] ?? 1;
    return {
      widget: String(c['widget'] ?? ''),
      element: String(c['element'] ?? ''),
      score: baseScore * weightMultiplier + contextBonus,
      reason: String(c['reason'] ?? 'default match'),
    };
  }).sort((a, b) => b.score - a.score);
};

// --- Implementation ---

export const widgetResolverHandler: WidgetResolverHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('overrides', `${input.resolver}:${input.element}`),
        mkStorageError,
      ),
      TE.chain((overrideRecord) =>
        pipe(
          O.fromNullable(overrideRecord),
          O.fold(
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.find('candidates', { element: input.element }),
                  mkStorageError,
                ),
                TE.chain((candidateRecords) => {
                  if (candidateRecords.length === 0) {
                    return TE.right(resolveNone(input.resolver, input.element));
                  }

                  return pipe(
                    TE.tryCatch(
                      () => storage.get('weights', input.resolver),
                      mkStorageError,
                    ),
                    TE.map((weightsRecord) => {
                      const scored = scoreCandidates(candidateRecords, weightsRecord);
                      const best = scored[0];

                      if (
                        scored.length > 1 &&
                        Math.abs(scored[0].score - scored[1].score) < AMBIGUITY_THRESHOLD
                      ) {
                        const candidateSummary = scored
                          .map((c) => `${c.widget}(${c.score.toFixed(2)})`)
                          .join(', ');
                        return resolveAmbiguous(input.resolver, candidateSummary);
                      }

                      return resolveOk(input.resolver, best.widget, best.score, best.reason);
                    }),
                  );
                }),
              ),
            (found) =>
              TE.right(
                resolveOk(input.resolver, String(found['widget'] ?? ''), 1.0, 'manual override'),
              ),
          ),
        ),
      ),
    ),

  resolveAll: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const elements: readonly string[] = JSON.parse(input.elements);
          return Promise.resolve(elements);
        },
        (error): WidgetResolverError => ({
          code: 'PARSE_ERROR',
          message: `Failed to parse elements: ${error instanceof Error ? error.message : String(error)}`,
        }),
      ),
      TE.chain((elements) =>
        TE.tryCatch(
          async () => {
            const resolved: Record<string, string> = {};
            const unresolved: string[] = [];

            for (const element of elements) {
              const overrideRec = await storage.get('overrides', `${input.resolver}:${element}`);
              if (overrideRec) {
                resolved[element] = String(overrideRec['widget'] ?? '');
                continue;
              }
              const candidates = await storage.find('candidates', { element });
              if (candidates.length > 0) {
                const weightsRec = await storage.get('weights', input.resolver);
                const scored = scoreCandidates(candidates, weightsRec);
                resolved[element] = scored[0].widget;
              } else {
                unresolved.push(element);
              }
            }

            if (unresolved.length === 0) {
              return resolveAllOk(input.resolver, JSON.stringify(resolved));
            }
            return resolveAllPartial(
              input.resolver,
              JSON.stringify(resolved),
              JSON.stringify(unresolved),
            );
          },
          mkStorageError,
        ),
      ),
    ),

  override: (input, storage) =>
    pipe(
      input.widget.trim().length === 0
        ? TE.right(overrideInvalid('Widget identifier must not be empty'))
        : pipe(
            TE.tryCatch(
              async () => {
                await storage.put('overrides', `${input.resolver}:${input.element}`, {
                  resolver: input.resolver,
                  element: input.element,
                  widget: input.widget,
                  createdAt: new Date().toISOString(),
                });
                return overrideOk(input.resolver);
              },
              mkStorageError,
            ),
          ),
    ),

  setWeights: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const parsed = JSON.parse(input.weights);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('Weights must be a JSON object mapping widget names to numeric weights');
          }
          const entries = Object.entries(parsed);
          for (const [key, val] of entries) {
            if (typeof val !== 'number' || val < 0) {
              throw new Error(`Weight for "${key}" must be a non-negative number, got ${val}`);
            }
          }
          return Promise.resolve(parsed as Record<string, unknown>);
        },
        (error): WidgetResolverError => ({
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        }),
      ),
      TE.chain((parsed) =>
        TE.tryCatch(
          async () => {
            await storage.put('weights', input.resolver, { resolver: input.resolver, ...parsed });
            return setWeightsOk(input.resolver);
          },
          mkStorageError,
        ),
      ),
      TE.orElse((err) =>
        err.code === 'VALIDATION_ERROR'
          ? TE.right(setWeightsInvalid(err.message))
          : TE.left(err),
      ),
    ),

  explain: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('candidates', { element: input.element }),
        mkStorageError,
      ),
      TE.chain((candidates) => {
        if (candidates.length === 0) {
          return TE.right(
            explainNotfound(`No candidates registered for element "${input.element}"`),
          );
        }

        return pipe(
          TE.tryCatch(
            async () => {
              const overrideRec = await storage.get('overrides', `${input.resolver}:${input.element}`);
              const weightsRec = await storage.get('weights', input.resolver);
              const scored = scoreCandidates(candidates, weightsRec);

              const lines: string[] = [];
              lines.push(`Resolution for element "${input.element}" in resolver "${input.resolver}":`);
              if (overrideRec) {
                lines.push(`  Manual override active -> widget "${overrideRec['widget']}"`);
              }
              lines.push(`  ${scored.length} candidate(s) evaluated:`);
              for (const c of scored) {
                lines.push(`    - ${c.widget}: score=${c.score.toFixed(3)}, reason="${c.reason}"`);
              }
              if (scored.length > 1 && Math.abs(scored[0].score - scored[1].score) < AMBIGUITY_THRESHOLD) {
                lines.push(`  WARNING: top candidates are ambiguous (score delta < ${AMBIGUITY_THRESHOLD})`);
              }

              return explainOk(input.resolver, lines.join('\n'));
            },
            mkStorageError,
          ),
        );
      }),
    ),
};
