// SyncEngine — Sync execution engine: registers compiled sync rules, matches
// action completions against triggers, evaluates where-guard conditions,
// queues pending sync invocations with dependency tracking, drains queued
// invocations when concepts become available, and surfaces unresolved conflicts.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncEngineStorage,
  SyncEngineRegisterSyncInput,
  SyncEngineRegisterSyncOutput,
  SyncEngineOnCompletionInput,
  SyncEngineOnCompletionOutput,
  SyncEngineEvaluateWhereInput,
  SyncEngineEvaluateWhereOutput,
  SyncEngineQueueSyncInput,
  SyncEngineQueueSyncOutput,
  SyncEngineOnAvailabilityChangeInput,
  SyncEngineOnAvailabilityChangeOutput,
  SyncEngineDrainConflictsInput,
  SyncEngineDrainConflictsOutput,
} from './types.js';

import {
  registerSyncOk,
  onCompletionOk,
  evaluateWhereOk,
  evaluateWhereError,
  queueSyncOk,
  onAvailabilityChangeOk,
  drainConflictsOk,
} from './types.js';

export interface SyncEngineError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): SyncEngineError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface SyncEngineHandler {
  readonly registerSync: (
    input: SyncEngineRegisterSyncInput,
    storage: SyncEngineStorage,
  ) => TE.TaskEither<SyncEngineError, SyncEngineRegisterSyncOutput>;
  readonly onCompletion: (
    input: SyncEngineOnCompletionInput,
    storage: SyncEngineStorage,
  ) => TE.TaskEither<SyncEngineError, SyncEngineOnCompletionOutput>;
  readonly evaluateWhere: (
    input: SyncEngineEvaluateWhereInput,
    storage: SyncEngineStorage,
  ) => TE.TaskEither<SyncEngineError, SyncEngineEvaluateWhereOutput>;
  readonly queueSync: (
    input: SyncEngineQueueSyncInput,
    storage: SyncEngineStorage,
  ) => TE.TaskEither<SyncEngineError, SyncEngineQueueSyncOutput>;
  readonly onAvailabilityChange: (
    input: SyncEngineOnAvailabilityChangeInput,
    storage: SyncEngineStorage,
  ) => TE.TaskEither<SyncEngineError, SyncEngineOnAvailabilityChangeOutput>;
  readonly drainConflicts: (
    input: SyncEngineDrainConflictsInput,
    storage: SyncEngineStorage,
  ) => TE.TaskEither<SyncEngineError, SyncEngineDrainConflictsOutput>;
}

// --- Implementation ---

interface CompiledSyncRule {
  readonly syncId?: string;
  readonly syncName?: string;
  readonly trigger?: {
    readonly conceptUri?: string;
    readonly action?: string;
    readonly variant?: string;
  };
  readonly effects?: readonly {
    readonly conceptUri?: string;
    readonly action?: string;
    readonly bindings?: Record<string, string>;
  }[];
  readonly guards?: readonly {
    readonly field?: string;
    readonly operator?: string;
    readonly value?: unknown;
  }[];
}

interface CompletionEvent {
  readonly conceptUri?: string;
  readonly action?: string;
  readonly variant?: string;
  readonly output?: Record<string, unknown>;
}

const matchesTrigger = (
  rule: CompiledSyncRule,
  completion: CompletionEvent,
): boolean => {
  if (!rule.trigger) return false;
  const conceptMatch =
    !rule.trigger.conceptUri ||
    rule.trigger.conceptUri === completion.conceptUri;
  const actionMatch =
    !rule.trigger.action || rule.trigger.action === completion.action;
  const variantMatch =
    !rule.trigger.variant || rule.trigger.variant === completion.variant;
  return conceptMatch && actionMatch && variantMatch;
};

const evaluateGuard = (
  guard: { readonly field?: string; readonly operator?: string; readonly value?: unknown },
  bindings: Record<string, unknown>,
): boolean => {
  const field = guard.field ?? '';
  const actualValue = bindings[field];
  const expectedValue = guard.value;
  const op = guard.operator ?? '==';

  switch (op) {
    case '==':
      return actualValue === expectedValue;
    case '!=':
      return actualValue !== expectedValue;
    case '>':
      return Number(actualValue) > Number(expectedValue);
    case '<':
      return Number(actualValue) < Number(expectedValue);
    case '>=':
      return Number(actualValue) >= Number(expectedValue);
    case '<=':
      return Number(actualValue) <= Number(expectedValue);
    case 'contains':
      return String(actualValue).includes(String(expectedValue));
    case 'startsWith':
      return String(actualValue).startsWith(String(expectedValue));
    default:
      return false;
  }
};

export const syncEngineHandler: SyncEngineHandler = {
  registerSync: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const sync = input.sync as CompiledSyncRule;
          const syncId = sync.syncId ?? `sync-${Date.now()}`;
          await storage.put('registered_syncs', syncId, {
            ...sync,
            syncId,
            registeredAt: new Date().toISOString(),
          });
          return registerSyncOk();
        },
        mkError('REGISTER_FAILED'),
      ),
    ),

  onCompletion: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('registered_syncs'),
        mkError('STORAGE_READ'),
      ),
      TE.chain((allSyncs) => {
        const completion = input.completion as CompletionEvent;
        const matchingRules = allSyncs.filter((syncRecord) => {
          const rule = syncRecord as unknown as CompiledSyncRule;
          return matchesTrigger(rule, completion);
        });

        if (matchingRules.length === 0) {
          return TE.right(onCompletionOk([]));
        }

        return pipe(
          TE.tryCatch(
            async () => {
              const invocations: unknown[] = [];

              for (const syncRecord of matchingRules) {
                const rule = syncRecord as unknown as CompiledSyncRule;
                const effects = rule.effects ?? [];

                for (const effect of effects) {
                  const resolvedBindings: Record<string, unknown> = {};
                  const mappings = effect.bindings ?? {};
                  const output = completion.output ?? {};

                  for (const [targetField, sourceExpr] of Object.entries(mappings)) {
                    const sourceField = sourceExpr.replace('$trigger.', '');
                    resolvedBindings[targetField] = output[sourceField] ?? sourceExpr;
                  }

                  invocations.push({
                    syncId: rule.syncId,
                    conceptUri: effect.conceptUri,
                    action: effect.action,
                    bindings: resolvedBindings,
                    triggeredBy: completion,
                  });
                }
              }

              return onCompletionOk(invocations);
            },
            mkError('COMPLETION_PROCESSING_FAILED'),
          ),
        );
      }),
    ),

  evaluateWhere: (input, storage) => {
    const bindings = (input.bindings ?? {}) as Record<string, unknown>;
    const queries = input.queries as readonly {
      readonly field?: string;
      readonly operator?: string;
      readonly value?: unknown;
    }[];

    if (!queries || !Array.isArray(queries)) {
      return TE.right(
        evaluateWhereError('Queries must be a non-empty array of guard conditions'),
      );
    }

    const results: unknown[] = [];

    for (const query of queries) {
      const passed = evaluateGuard(query, bindings);
      results.push({
        guard: query,
        passed,
        actualValue: bindings[query.field ?? ''],
      });
    }

    const allPassed = results.every(
      (r) => (r as { readonly passed: boolean }).passed,
    );

    if (!allPassed) {
      const failedGuards = results.filter(
        (r) => !(r as { readonly passed: boolean }).passed,
      );
      return TE.right(
        evaluateWhereError(
          `Guard conditions not met: ${JSON.stringify(failedGuards)}`,
        ),
      );
    }

    return TE.right(evaluateWhereOk(results));
  },

  queueSync: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const pendingId = `pending-${input.flow}-${Date.now()}`;
          await storage.put('pending_syncs', pendingId, {
            pendingId,
            sync: input.sync,
            bindings: input.bindings,
            flow: input.flow,
            status: 'pending',
            queuedAt: new Date().toISOString(),
          });
          return queueSyncOk(pendingId);
        },
        mkError('QUEUE_FAILED'),
      ),
    ),

  onAvailabilityChange: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.put('concept_availability', input.conceptUri, {
            conceptUri: input.conceptUri,
            available: input.available,
            updatedAt: new Date().toISOString(),
          });

          if (!input.available) {
            return onAvailabilityChangeOk([]);
          }

          const pendingSyncs = await storage.find('pending_syncs', {
            status: 'pending',
          });

          const drainedInvocations: unknown[] = [];

          for (const pending of pendingSyncs) {
            const sync = pending.sync as CompiledSyncRule;
            const effects = sync?.effects ?? [];
            const needsThisConcept = effects.some(
              (e) => e.conceptUri === input.conceptUri,
            );

            if (needsThisConcept) {
              drainedInvocations.push({
                pendingId: pending.pendingId,
                sync: pending.sync,
                bindings: pending.bindings,
                flow: pending.flow,
              });
              await storage.put('pending_syncs', String(pending.pendingId), {
                ...pending,
                status: 'drained',
                drainedAt: new Date().toISOString(),
              });
            }
          }

          return onAvailabilityChangeOk(drainedInvocations);
        },
        mkError('AVAILABILITY_CHANGE_FAILED'),
      ),
    ),

  drainConflicts: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allConflicts = await storage.find('sync_conflicts', {
            resolved: false,
          });
          return drainConflictsOk(
            allConflicts.map((c) => ({
              conflictId: c.conflictId,
              syncId: c.syncId,
              conceptUri: c.conceptUri,
              field: c.field,
              valueA: c.valueA,
              valueB: c.valueB,
              detectedAt: c.detectedAt,
            })),
          );
        },
        mkError('DRAIN_CONFLICTS_FAILED'),
      ),
    ),
};
