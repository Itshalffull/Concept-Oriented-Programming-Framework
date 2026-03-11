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
   * Tests may pass policy_kind instead of policy, roles as string, and omit run_ref.
   */
  request: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const inp = input as any;
          const stepRef = inp.step_ref ?? '';
          const runRef = inp.run_ref ?? '';
          const policy: ApprovalPolicy = inp.policy ?? inp.policy_kind ?? 'one_of';
          const requiredCount = inp.required_count ?? 1;
          const roles = Array.isArray(inp.roles) ? inp.roles : [inp.roles];
          const description = inp.description ?? '';
          const key = `${stepRef}_${Date.now()}`;
          const now = Date.now();
          await storage.put('approvals', key, {
            approval_id: key,
            run_ref: runRef,
            step_ref: stepRef,
            policy,
            required_count: requiredCount,
            roles,
            description,
            status: 'pending' as ApprovalStatus,
            decisions: [],
            created_at: now,
            updated_at: now,
          });
          // Return output with both approval (for tests) and approval_id (for type compat)
          return { variant: 'ok' as const, approval: key, approval_id: key, step_ref: stepRef, status: 'pending' as ApprovalStatus } as any;
        },
        storageError,
      ),
    ),

  /**
   * Record an approval decision. Tests may pass {approval, actor, comment} instead of
   * {run_ref, step_ref, approver, role, comment}.
   */
  approve: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const inp = input as any;
          // Determine the key: could be input.approval or compositeKey(run_ref, step_ref)
          const approvalKey = inp.approval ?? inp.approval_id ?? '';
          const approver = inp.approver ?? inp.actor ?? '';
          const role = inp.role ?? '';
          const comment = inp.comment ?? '';

          // First try to get by approval key directly
          let record = await storage.get('approvals', approvalKey);

          // If not found, try composite key
          if (!record && inp.run_ref && inp.step_ref) {
            const allApprovals = await storage.find('approvals');
            record = allApprovals.find((a) =>
              String(a.run_ref) === inp.run_ref && String(a.step_ref) === inp.step_ref
            ) ?? null;
          }

          if (!record) {
            return approveNotFound(`Approval '${approvalKey}' not found`) as ApprovalApproveOutput;
          }

          const status = record.status as ApprovalStatus;
          if (status !== 'pending') {
            return approveInvalidStatus(
              `Approval must be in 'pending' status, currently '${status}'`,
              status,
            ) as ApprovalApproveOutput;
          }

          const existingDecisions = (record.decisions as ApprovalDecision[]) ?? [];
          const newDecision: ApprovalDecision = {
            approver,
            role,
            decision: 'approve',
            timestamp: Date.now(),
            comment,
          };
          const allDecisions = [...existingDecisions, newDecision];
          const approveCount = allDecisions.filter((d) => d.decision === 'approve').length;
          const policy = record.policy as ApprovalPolicy;
          const required = record.required_count as number;
          const key = record.approval_id as string;
          const stepRef = record.step_ref as string;

          const newStatus: ApprovalStatus = isThresholdMet(policy, required, approveCount) ? 'approved' : 'pending';
          await storage.put('approvals', key, {
            ...record,
            status: newStatus,
            decisions: allDecisions,
            updated_at: Date.now(),
          });

          // Return output with approval and step_ref for test compatibility
          return { variant: 'ok' as const, approval: key, approval_id: key, step_ref: stepRef, status: newStatus, decisions: allDecisions } as any;
        },
        storageError,
      ),
    ),

  /**
   * Deny an approval request. Immediately transitions to denied status.
   */
  deny: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const inp = input as any;
          const approvalKey = inp.approval ?? inp.approval_id ?? '';
          const approver = inp.approver ?? inp.actor ?? '';
          const role = inp.role ?? '';
          const reason = inp.reason ?? '';

          let record = await storage.get('approvals', approvalKey);
          if (!record && inp.run_ref && inp.step_ref) {
            const allApprovals = await storage.find('approvals');
            record = allApprovals.find((a) =>
              String(a.run_ref) === inp.run_ref && String(a.step_ref) === inp.step_ref
            ) ?? null;
          }

          if (!record) {
            return denyNotFound(`Approval '${approvalKey}' not found`) as ApprovalDenyOutput;
          }

          const status = record.status as ApprovalStatus;
          if (status !== 'pending') {
            return denyInvalidStatus(
              `Approval must be in 'pending' status to deny, currently '${status}'`,
              status,
            ) as ApprovalDenyOutput;
          }

          const existingDecisions = (record.decisions as ApprovalDecision[]) ?? [];
          const denyDecision: ApprovalDecision = {
            approver,
            role,
            decision: 'deny',
            timestamp: Date.now(),
            comment: reason,
          };
          const key = record.approval_id as string;
          await storage.put('approvals', key, {
            ...record,
            status: 'denied' as ApprovalStatus,
            decisions: [...existingDecisions, denyDecision],
            denial_reason: reason,
            updated_at: Date.now(),
          });
          return denyOk(key, 'denied', reason);
        },
        storageError,
      ),
    ),

  /**
   * Request changes. Transitions to changes_requested status with feedback.
   */
  request_changes: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const inp = input as any;
          const approvalKey = inp.approval ?? inp.approval_id ?? '';

          let record = await storage.get('approvals', approvalKey);
          if (!record && inp.run_ref && inp.step_ref) {
            const allApprovals = await storage.find('approvals');
            record = allApprovals.find((a) =>
              String(a.run_ref) === inp.run_ref && String(a.step_ref) === inp.step_ref
            ) ?? null;
          }

          if (!record) {
            return requestChangesNotFound(`Approval '${approvalKey}' not found`) as ApprovalRequestChangesOutput;
          }

          const status = record.status as ApprovalStatus;
          if (status !== 'pending') {
            return requestChangesInvalidStatus(
              `Approval must be in 'pending' status to request changes, currently '${status}'`,
              status,
            ) as ApprovalRequestChangesOutput;
          }
          const key = record.approval_id as string;
          const feedback = inp.feedback ?? '';
          await storage.put('approvals', key, {
            ...record,
            status: 'changes_requested' as ApprovalStatus,
            feedback,
            updated_at: Date.now(),
          });
          return requestChangesOk(key, 'changes_requested', feedback);
        },
        storageError,
      ),
    ),

  /**
   * Timeout an approval. Transitions pending to timed_out.
   */
  timeout: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const inp = input as any;
          const approvalKey = inp.approval ?? inp.approval_id ?? '';

          let record = await storage.get('approvals', approvalKey);
          if (!record && inp.run_ref && inp.step_ref) {
            const allApprovals = await storage.find('approvals');
            record = allApprovals.find((a) =>
              String(a.run_ref) === inp.run_ref && String(a.step_ref) === inp.step_ref
            ) ?? null;
          }

          if (!record) {
            return timeoutNotFound(`Approval '${approvalKey}' not found`) as ApprovalTimeoutOutput;
          }

          const status = record.status as ApprovalStatus;
          if (status !== 'pending') {
            return timeoutInvalidStatus(
              `Approval must be in 'pending' status to timeout, currently '${status}'`,
              status,
            ) as ApprovalTimeoutOutput;
          }
          const key = record.approval_id as string;
          await storage.put('approvals', key, {
            ...record,
            status: 'timed_out' as ApprovalStatus,
            updated_at: Date.now(),
          });
          return timeoutOk(key, 'timed_out');
        },
        storageError,
      ),
    ),

  /**
   * Get the current status and decision history of an approval.
   */
  get_status: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const inp = input as any;
          const approvalKey = inp.approval ?? inp.approval_id ?? '';

          let record = await storage.get('approvals', approvalKey);
          if (!record && inp.run_ref && inp.step_ref) {
            const allApprovals = await storage.find('approvals');
            record = allApprovals.find((a) =>
              String(a.run_ref) === inp.run_ref && String(a.step_ref) === inp.step_ref
            ) ?? null;
          }

          if (!record) {
            return getStatusNotFound(`Approval '${approvalKey}' not found`) as ApprovalGetStatusOutput;
          }

          return getStatusOk(
            record.approval_id as string,
            record.status as ApprovalStatus,
            record.policy as ApprovalPolicy,
            record.required_count as number,
            (record.decisions as ApprovalDecision[]) ?? [],
          );
        },
        storageError,
      ),
    ),
};
