// Escalation — handler.ts
// Real fp-ts domain logic for escalation lifecycle with severity tracking and re-escalation support.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EscalationStorage,
  EscalationStatus,
  EscalationEscalateInput,
  EscalationEscalateOutput,
  EscalationAcceptInput,
  EscalationAcceptOutput,
  EscalationResolveInput,
  EscalationResolveOutput,
  EscalationReEscalateInput,
  EscalationReEscalateOutput,
} from './types.js';

import {
  escalateOk,
  acceptOk,
  acceptNotFound,
  acceptInvalidStatus,
  resolveOk,
  resolveNotFound,
  resolveInvalidStatus,
  reEscalateOk,
  reEscalateNotFound,
  reEscalateInvalidStatus,
} from './types.js';

export interface EscalationError {
  readonly code: string;
  readonly message: string;
}

export interface EscalationHandler {
  readonly escalate: (
    input: EscalationEscalateInput,
    storage: EscalationStorage,
  ) => TE.TaskEither<EscalationError, EscalationEscalateOutput>;
  readonly accept: (
    input: EscalationAcceptInput,
    storage: EscalationStorage,
  ) => TE.TaskEither<EscalationError, EscalationAcceptOutput>;
  readonly resolve: (
    input: EscalationResolveInput,
    storage: EscalationStorage,
  ) => TE.TaskEither<EscalationError, EscalationResolveOutput>;
  readonly re_escalate: (
    input: EscalationReEscalateInput,
    storage: EscalationStorage,
  ) => TE.TaskEither<EscalationError, EscalationReEscalateOutput>;
}

// --- Pure helpers ---

const compositeKey = (run_ref: string, step_ref: string): string =>
  `${run_ref}::${step_ref}`;

const storageError = (error: unknown): EscalationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const escalationHandler: EscalationHandler = {
  /**
   * Create a new escalation. Stores with severity, target, and initial escalated status.
   */
  escalate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = compositeKey(input.run_ref, input.step_ref);
          const now = Date.now();
          await storage.put('escalations', key, {
            escalation_id: key,
            run_ref: input.run_ref,
            step_ref: input.step_ref,
            reason: input.reason,
            severity: input.severity,
            escalation_target: input.escalation_target,
            context: input.context ?? {},
            status: 'escalated' as EscalationStatus,
            escalation_count: 1,
            history: [
              {
                action: 'escalate',
                target: input.escalation_target,
                reason: input.reason,
                timestamp: now,
              },
            ],
            accepted_by: null,
            resolution: null,
            created_at: now,
            updated_at: now,
          });
          return escalateOk(key, 'escalated', input.severity);
        },
        storageError,
      ),
    ),

  /**
   * Accept an escalation. Transitions from escalated to accepted.
   */
  accept: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('escalations', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<EscalationError, EscalationAcceptOutput>(
              acceptNotFound(`Escalation '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (esc) => {
              const status = esc.status as EscalationStatus;
              if (status !== 'escalated') {
                return TE.right<EscalationError, EscalationAcceptOutput>(
                  acceptInvalidStatus(
                    `Escalation must be in 'escalated' status to accept, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  const history = (esc.history as Record<string, unknown>[]) ?? [];
                  await storage.put('escalations', key, {
                    ...esc,
                    status: 'accepted' as EscalationStatus,
                    accepted_by: input.accepted_by,
                    history: [
                      ...history,
                      { action: 'accept', accepted_by: input.accepted_by, timestamp: Date.now() },
                    ],
                    updated_at: Date.now(),
                  });
                  return acceptOk(key, 'accepted', input.accepted_by);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Resolve an escalation. Transitions from accepted to resolved.
   */
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('escalations', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<EscalationError, EscalationResolveOutput>(
              resolveNotFound(`Escalation '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (esc) => {
              const status = esc.status as EscalationStatus;
              if (status !== 'accepted') {
                return TE.right<EscalationError, EscalationResolveOutput>(
                  resolveInvalidStatus(
                    `Escalation must be in 'accepted' status to resolve, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  const history = (esc.history as Record<string, unknown>[]) ?? [];
                  await storage.put('escalations', key, {
                    ...esc,
                    status: 'resolved' as EscalationStatus,
                    resolution: input.resolution,
                    resolved_by: input.resolved_by,
                    history: [
                      ...history,
                      {
                        action: 'resolve',
                        resolution: input.resolution,
                        resolved_by: input.resolved_by,
                        timestamp: Date.now(),
                      },
                    ],
                    updated_at: Date.now(),
                  });
                  return resolveOk(key, 'resolved', input.resolution);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Re-escalate to a different target. Allowed from escalated or accepted status.
   * Increments escalation_count and records the new target in history.
   */
  re_escalate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('escalations', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<EscalationError, EscalationReEscalateOutput>(
              reEscalateNotFound(`Escalation '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (esc) => {
              const status = esc.status as EscalationStatus;
              if (status !== 'escalated' && status !== 'accepted') {
                return TE.right<EscalationError, EscalationReEscalateOutput>(
                  reEscalateInvalidStatus(
                    `Escalation must be in 'escalated' or 'accepted' status to re-escalate, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              const currentCount = (esc.escalation_count as number) ?? 1;
              const newCount = currentCount + 1;
              return TE.tryCatch(
                async () => {
                  const history = (esc.history as Record<string, unknown>[]) ?? [];
                  await storage.put('escalations', key, {
                    ...esc,
                    status: 'escalated' as EscalationStatus,
                    escalation_target: input.new_target,
                    escalation_count: newCount,
                    accepted_by: null,
                    history: [
                      ...history,
                      {
                        action: 're_escalate',
                        new_target: input.new_target,
                        reason: input.reason,
                        timestamp: Date.now(),
                      },
                    ],
                    updated_at: Date.now(),
                  });
                  return reEscalateOk(key, 'escalated', input.new_target, newCount);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
