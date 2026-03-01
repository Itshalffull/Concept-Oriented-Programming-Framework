// Approval — handler.ts
// Real fp-ts domain logic for multi-party approval with configurable policies (one_of, all_of, n_of_m).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ApprovalStorage,
  ApprovalStatus,
  ApprovalPolicy,
  ApprovalDecision,
  ApprovalRequestInput,
  ApprovalRequestOutput,
  ApprovalApproveInput,
  ApprovalApproveOutput,
  ApprovalDenyInput,
  ApprovalDenyOutput,
  ApprovalRequestChangesInput,
  ApprovalRequestChangesOutput,
  ApprovalTimeoutInput,
  ApprovalTimeoutOutput,
  ApprovalGetStatusInput,
  ApprovalGetStatusOutput,
} from './types.js';

import {
  requestOk,
  approveApproved,
  approvePending,
  approveNotFound,
  approveInvalidStatus,
  denyOk,
  denyNotFound,
  denyInvalidStatus,
  requestChangesOk,
  requestChangesNotFound,
  requestChangesInvalidStatus,
  timeoutOk,
  timeoutNotFound,
  timeoutInvalidStatus,
  getStatusOk,
  getStatusNotFound,
} from './types.js';

export interface ApprovalError {
  readonly code: string;
  readonly message: string;
}

export interface ApprovalHandler {
  readonly request: (
    input: ApprovalRequestInput,
    storage: ApprovalStorage,
  ) => TE.TaskEither<ApprovalError, ApprovalRequestOutput>;
  readonly approve: (
    input: ApprovalApproveInput,
    storage: ApprovalStorage,
  ) => TE.TaskEither<ApprovalError, ApprovalApproveOutput>;
  readonly deny: (
    input: ApprovalDenyInput,
    storage: ApprovalStorage,
  ) => TE.TaskEither<ApprovalError, ApprovalDenyOutput>;
  readonly request_changes: (
    input: ApprovalRequestChangesInput,
    storage: ApprovalStorage,
  ) => TE.TaskEither<ApprovalError, ApprovalRequestChangesOutput>;
  readonly timeout: (
    input: ApprovalTimeoutInput,
    storage: ApprovalStorage,
  ) => TE.TaskEither<ApprovalError, ApprovalTimeoutOutput>;
  readonly get_status: (
    input: ApprovalGetStatusInput,
    storage: ApprovalStorage,
  ) => TE.TaskEither<ApprovalError, ApprovalGetStatusOutput>;
}

// --- Pure helpers ---

const compositeKey = (run_ref: string, step_ref: string): string =>
  `${run_ref}::${step_ref}`;

const storageError = (error: unknown): ApprovalError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/**
 * Determine whether approval threshold is met based on the policy type.
 * - one_of: a single approval suffices
 * - all_of: every required role must have approved
 * - n_of_m: required_count approvals needed
 */
const isThresholdMet = (
  policy: ApprovalPolicy,
  required_count: number,
  approve_count: number,
): boolean => {
  switch (policy) {
    case 'one_of':
      return approve_count >= 1;
    case 'all_of':
      return approve_count >= required_count;
    case 'n_of_m':
      return approve_count >= required_count;
  }
};

// --- Implementation ---

export const approvalHandler: ApprovalHandler = {
  /**
   * Request an approval. Creates a pending approval record with the given policy,
   * required count, and eligible roles.
   */
  request: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = compositeKey(input.run_ref, input.step_ref);
          const now = Date.now();
          await storage.put('approvals', key, {
            approval_id: key,
            run_ref: input.run_ref,
            step_ref: input.step_ref,
            policy: input.policy,
            required_count: input.required_count,
            roles: [...input.roles],
            description: input.description ?? '',
            status: 'pending' as ApprovalStatus,
            decisions: [],
            created_at: now,
            updated_at: now,
          });
          return requestOk(key, 'pending');
        },
        storageError,
      ),
    ),

  /**
   * Record an approval decision. If the policy threshold is met, transitions to
   * approved status. Otherwise remains pending and reports progress.
   */
  approve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('approvals', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ApprovalError, ApprovalApproveOutput>(
              approveNotFound(`Approval '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (approval) => {
              const status = approval.status as ApprovalStatus;
              if (status !== 'pending') {
                return TE.right<ApprovalError, ApprovalApproveOutput>(
                  approveInvalidStatus(
                    `Approval must be in 'pending' status, currently '${status}'`,
                    status,
                  ),
                );
              }

              const existingDecisions = (approval.decisions as ApprovalDecision[]) ?? [];
              const newDecision: ApprovalDecision = {
                approver: input.approver,
                role: input.role,
                decision: 'approve',
                timestamp: Date.now(),
                comment: input.comment,
              };
              const allDecisions = [...existingDecisions, newDecision];
              const approveCount = allDecisions.filter((d) => d.decision === 'approve').length;
              const policy = approval.policy as ApprovalPolicy;
              const required = approval.required_count as number;
              const key = compositeKey(input.run_ref, input.step_ref);

              if (isThresholdMet(policy, required, approveCount)) {
                return TE.tryCatch(
                  async () => {
                    await storage.put('approvals', key, {
                      ...approval,
                      status: 'approved' as ApprovalStatus,
                      decisions: allDecisions,
                      updated_at: Date.now(),
                    });
                    return approveApproved(key, 'approved', allDecisions);
                  },
                  storageError,
                );
              }

              return TE.tryCatch(
                async () => {
                  await storage.put('approvals', key, {
                    ...approval,
                    decisions: allDecisions,
                    updated_at: Date.now(),
                  });
                  return approvePending(key, 'pending', approveCount, required);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Deny an approval request. Immediately transitions to denied status.
   */
  deny: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('approvals', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ApprovalError, ApprovalDenyOutput>(
              denyNotFound(`Approval '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (approval) => {
              const status = approval.status as ApprovalStatus;
              if (status !== 'pending') {
                return TE.right<ApprovalError, ApprovalDenyOutput>(
                  denyInvalidStatus(
                    `Approval must be in 'pending' status to deny, currently '${status}'`,
                    status,
                  ),
                );
              }

              const existingDecisions = (approval.decisions as ApprovalDecision[]) ?? [];
              const denyDecision: ApprovalDecision = {
                approver: input.approver,
                role: input.role,
                decision: 'deny',
                timestamp: Date.now(),
                comment: input.reason,
              };
              const key = compositeKey(input.run_ref, input.step_ref);

              return TE.tryCatch(
                async () => {
                  await storage.put('approvals', key, {
                    ...approval,
                    status: 'denied' as ApprovalStatus,
                    decisions: [...existingDecisions, denyDecision],
                    denial_reason: input.reason,
                    updated_at: Date.now(),
                  });
                  return denyOk(key, 'denied', input.reason);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Request changes. Transitions to changes_requested status with feedback.
   */
  request_changes: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('approvals', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ApprovalError, ApprovalRequestChangesOutput>(
              requestChangesNotFound(`Approval '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (approval) => {
              const status = approval.status as ApprovalStatus;
              if (status !== 'pending') {
                return TE.right<ApprovalError, ApprovalRequestChangesOutput>(
                  requestChangesInvalidStatus(
                    `Approval must be in 'pending' status to request changes, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  await storage.put('approvals', key, {
                    ...approval,
                    status: 'changes_requested' as ApprovalStatus,
                    feedback: input.feedback,
                    updated_at: Date.now(),
                  });
                  return requestChangesOk(key, 'changes_requested', input.feedback);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Timeout an approval. Transitions pending to timed_out.
   */
  timeout: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('approvals', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ApprovalError, ApprovalTimeoutOutput>(
              timeoutNotFound(`Approval '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (approval) => {
              const status = approval.status as ApprovalStatus;
              if (status !== 'pending') {
                return TE.right<ApprovalError, ApprovalTimeoutOutput>(
                  timeoutInvalidStatus(
                    `Approval must be in 'pending' status to timeout, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  await storage.put('approvals', key, {
                    ...approval,
                    status: 'timed_out' as ApprovalStatus,
                    updated_at: Date.now(),
                  });
                  return timeoutOk(key, 'timed_out');
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Get the current status and decision history of an approval.
   */
  get_status: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('approvals', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ApprovalError, ApprovalGetStatusOutput>(
              getStatusNotFound(`Approval '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (approval) =>
              TE.right<ApprovalError, ApprovalGetStatusOutput>(
                getStatusOk(
                  approval.approval_id as string,
                  approval.status as ApprovalStatus,
                  approval.policy as ApprovalPolicy,
                  approval.required_count as number,
                  (approval.decisions as ApprovalDecision[]) ?? [],
                ),
              ),
          ),
        ),
      ),
    ),
};
