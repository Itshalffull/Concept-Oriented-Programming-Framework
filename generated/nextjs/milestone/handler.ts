// Milestone — Process observability milestones with condition-based evaluation and revocation.
// Milestones transition between pending and achieved states, with revoke returning to pending.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MilestoneStorage,
  MilestoneDefineInput,
  MilestoneDefineOutput,
  MilestoneEvaluateInput,
  MilestoneEvaluateOutput,
  MilestoneRevokeInput,
  MilestoneRevokeOutput,
} from './types.js';

import {
  defineOk,
  evaluateAchieved,
  evaluateNotYet,
  evaluateAlreadyAchieved,
  evaluateNotfound,
  revokeOk,
  revokeNotfound,
  revokeInvalidStatus,
} from './types.js';

export interface MilestoneError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): MilestoneError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Evaluate a condition expression against a context object.
// Condition is a simple JSON key-value match: all keys in condition must match values in context.
const evaluateCondition = (conditionStr: string, contextStr: string): boolean => {
  try {
    const condition = JSON.parse(conditionStr) as Record<string, unknown>;
    const context = JSON.parse(contextStr) as Record<string, unknown>;
    return Object.entries(condition).every(([key, value]) => {
      const contextValue = context[key];
      if (typeof value === 'number') return Number(contextValue) >= value;
      return contextValue === value;
    });
  } catch {
    return false;
  }
};

export interface MilestoneHandler {
  readonly define: (
    input: MilestoneDefineInput,
    storage: MilestoneStorage,
  ) => TE.TaskEither<MilestoneError, MilestoneDefineOutput>;
  readonly evaluate: (
    input: MilestoneEvaluateInput,
    storage: MilestoneStorage,
  ) => TE.TaskEither<MilestoneError, MilestoneEvaluateOutput>;
  readonly revoke: (
    input: MilestoneRevokeInput,
    storage: MilestoneStorage,
  ) => TE.TaskEither<MilestoneError, MilestoneRevokeOutput>;
}

// --- Implementation ---

export const milestoneHandler: MilestoneHandler = {
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          await storage.put('milestone', input.milestone_id, {
            milestone_id: input.milestone_id,
            name: input.name,
            description: input.description,
            condition: input.condition,
            status: 'pending',
            achieved_at: null,
            revoked_at: null,
            revoke_reason: null,
            createdAt: now,
            updatedAt: now,
          });
          return defineOk(input.milestone_id);
        },
        toStorageError,
      ),
    ),

  evaluate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('milestone', input.milestone_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                evaluateNotfound(`Milestone '${input.milestone_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status === 'achieved') {
                return TE.right(
                  evaluateAlreadyAchieved(
                    input.milestone_id,
                    String(existing['achieved_at']),
                  ),
                );
              }
              const conditionStr = String(existing['condition'] ?? '{}');
              const met = evaluateCondition(conditionStr, input.context);
              if (!met) {
                return TE.right(
                  evaluateNotYet(input.milestone_id, conditionStr),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('milestone', input.milestone_id, {
                    ...existing,
                    status: 'achieved',
                    achieved_at: now,
                    updatedAt: now,
                  });
                  return evaluateAchieved(input.milestone_id, now);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  revoke: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('milestone', input.milestone_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                revokeNotfound(`Milestone '${input.milestone_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'achieved') {
                return TE.right(
                  revokeInvalidStatus(
                    `Cannot revoke: milestone is in '${status}' status, expected 'achieved'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('milestone', input.milestone_id, {
                    ...existing,
                    status: 'pending',
                    achieved_at: null,
                    revoked_at: now,
                    revoke_reason: input.reason,
                    updatedAt: now,
                  });
                  return revokeOk(input.milestone_id);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),
};
