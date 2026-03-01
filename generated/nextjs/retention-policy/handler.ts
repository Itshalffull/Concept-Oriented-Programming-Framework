// RetentionPolicy — Data retention rules: define retention periods per record type,
// apply and release legal holds, evaluate disposition eligibility, dispose records,
// and maintain an audit log of disposal actions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RetentionPolicyStorage,
  RetentionPolicySetRetentionInput,
  RetentionPolicySetRetentionOutput,
  RetentionPolicyApplyHoldInput,
  RetentionPolicyApplyHoldOutput,
  RetentionPolicyReleaseHoldInput,
  RetentionPolicyReleaseHoldOutput,
  RetentionPolicyCheckDispositionInput,
  RetentionPolicyCheckDispositionOutput,
  RetentionPolicyDisposeInput,
  RetentionPolicyDisposeOutput,
  RetentionPolicyAuditLogInput,
  RetentionPolicyAuditLogOutput,
} from './types.js';

import {
  setRetentionOk,
  setRetentionAlreadyExists,
  applyHoldOk,
  releaseHoldOk,
  releaseHoldNotFound,
  releaseHoldAlreadyReleased,
  checkDispositionDisposable,
  checkDispositionRetained,
  checkDispositionHeld,
  disposeOk,
  disposeRetained,
  disposeHeld,
  auditLogOk,
} from './types.js';

export interface RetentionPolicyError {
  readonly code: string;
  readonly message: string;
}

const toRetentionPolicyError = (error: unknown): RetentionPolicyError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface RetentionPolicyHandler {
  readonly setRetention: (
    input: RetentionPolicySetRetentionInput,
    storage: RetentionPolicyStorage,
  ) => TE.TaskEither<RetentionPolicyError, RetentionPolicySetRetentionOutput>;
  readonly applyHold: (
    input: RetentionPolicyApplyHoldInput,
    storage: RetentionPolicyStorage,
  ) => TE.TaskEither<RetentionPolicyError, RetentionPolicyApplyHoldOutput>;
  readonly releaseHold: (
    input: RetentionPolicyReleaseHoldInput,
    storage: RetentionPolicyStorage,
  ) => TE.TaskEither<RetentionPolicyError, RetentionPolicyReleaseHoldOutput>;
  readonly checkDisposition: (
    input: RetentionPolicyCheckDispositionInput,
    storage: RetentionPolicyStorage,
  ) => TE.TaskEither<RetentionPolicyError, RetentionPolicyCheckDispositionOutput>;
  readonly dispose: (
    input: RetentionPolicyDisposeInput,
    storage: RetentionPolicyStorage,
  ) => TE.TaskEither<RetentionPolicyError, RetentionPolicyDisposeOutput>;
  readonly auditLog: (
    input: RetentionPolicyAuditLogInput,
    storage: RetentionPolicyStorage,
  ) => TE.TaskEither<RetentionPolicyError, RetentionPolicyAuditLogOutput>;
}

// --- Implementation ---

export const retentionPolicyHandler: RetentionPolicyHandler = {
  // Define a retention policy for a record type. Returns alreadyExists if one is set.
  setRetention: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('retention_policy', input.recordType),
        toRetentionPolicyError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const policyId = `rp:${input.recordType}`;
                  await storage.put('retention_policy', input.recordType, {
                    policyId,
                    recordType: input.recordType,
                    period: input.period,
                    unit: input.unit,
                    dispositionAction: input.dispositionAction,
                    createdAt: new Date().toISOString(),
                  });
                  return setRetentionOk(policyId);
                },
                toRetentionPolicyError,
              ),
            () =>
              TE.right<RetentionPolicyError, RetentionPolicySetRetentionOutput>(
                setRetentionAlreadyExists(`Retention policy for '${input.recordType}' already exists`),
              ),
          ),
        ),
      ),
    ),

  // Apply a legal hold that prevents disposal of records within its scope.
  applyHold: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const holdId = `hold:${input.name}:${Date.now()}`;
          await storage.put('hold', holdId, {
            holdId,
            name: input.name,
            scope: input.scope,
            reason: input.reason,
            issuer: input.issuer,
            active: true,
            appliedAt: new Date().toISOString(),
          });
          return applyHoldOk(holdId);
        },
        toRetentionPolicyError,
      ),
    ),

  // Release a legal hold. Returns notFound or alreadyReleased as appropriate.
  releaseHold: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hold', String(input.holdId)),
        toRetentionPolicyError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<RetentionPolicyError, RetentionPolicyReleaseHoldOutput>(
                releaseHoldNotFound(`Hold '${String(input.holdId)}' not found`),
              ),
            (found) => {
              const r = found as Record<string, unknown>;
              if (r.active === false) {
                return TE.right<RetentionPolicyError, RetentionPolicyReleaseHoldOutput>(
                  releaseHoldAlreadyReleased(`Hold '${String(input.holdId)}' was already released`),
                );
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('hold', String(input.holdId), {
                    ...found,
                    active: false,
                    releasedBy: input.releasedBy,
                    releaseReason: input.reason,
                    releasedAt: new Date().toISOString(),
                  });
                  return releaseHoldOk();
                },
                toRetentionPolicyError,
              );
            },
          ),
        ),
      ),
    ),

  // Check whether a record is eligible for disposal, retained, or under hold.
  checkDisposition: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check active holds that cover this record
          const holds = await storage.find('hold', { active: true });
          const activeHoldNames: string[] = [];
          for (const h of holds) {
            const r = h as Record<string, unknown>;
            const scope = String(r.scope ?? '');
            if (scope === '*' || scope === input.record || input.record.startsWith(scope)) {
              activeHoldNames.push(String(r.name ?? ''));
            }
          }
          if (activeHoldNames.length > 0) {
            return checkDispositionHeld(activeHoldNames);
          }

          // Check retention policies
          const policies = await storage.find('retention_policy');
          for (const p of policies) {
            const r = p as Record<string, unknown>;
            const policyId = String(r.policyId ?? '');
            const period = Number(r.period ?? 0);
            const unit = String(r.unit ?? 'days');
            const createdAt = String(r.createdAt ?? '');
            if (createdAt && period > 0) {
              const created = new Date(createdAt);
              const multiplier = unit === 'years' ? 365 * 24 * 60 * 60 * 1000
                : unit === 'months' ? 30 * 24 * 60 * 60 * 1000
                : 24 * 60 * 60 * 1000;
              const expiresAt = new Date(created.getTime() + period * multiplier);
              if (expiresAt.getTime() > Date.now()) {
                return checkDispositionRetained(
                  `Retention period active for ${period} ${unit}`,
                  expiresAt.toISOString(),
                );
              }
            }
          }

          // Default: eligible for disposal
          const defaultPolicyId = `rp:${input.record}`;
          return checkDispositionDisposable(defaultPolicyId);
        },
        toRetentionPolicyError,
      ),
    ),

  // Dispose a record if it is not under retention or hold.
  dispose: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check holds
          const holds = await storage.find('hold', { active: true });
          const activeHoldNames: string[] = [];
          for (const h of holds) {
            const r = h as Record<string, unknown>;
            const scope = String(r.scope ?? '');
            if (scope === '*' || scope === input.record || input.record.startsWith(scope)) {
              activeHoldNames.push(String(r.name ?? ''));
            }
          }
          if (activeHoldNames.length > 0) {
            return disposeHeld(activeHoldNames);
          }

          // Record the disposal in the audit log
          const auditKey = `disposed:${input.record}:${Date.now()}`;
          await storage.put('disposal_log', auditKey, {
            record: input.record,
            policy: `rp:${input.record}`,
            disposedAt: new Date().toISOString(),
            disposedBy: input.disposedBy,
          });
          return disposeOk();
        },
        toRetentionPolicyError,
      ),
    ),

  // Retrieve the audit log of disposal actions, optionally filtered by record.
  auditLog: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allLogs = await storage.find('disposal_log');
          const filterRecord = pipe(
            input.record,
            O.fold(() => null, (r) => r),
          );
          const entries = allLogs
            .filter((log) => {
              if (filterRecord === null) return true;
              return String((log as Record<string, unknown>).record ?? '') === filterRecord;
            })
            .map((log) => {
              const r = log as Record<string, unknown>;
              return {
                record: String(r.record ?? ''),
                policy: String(r.policy ?? ''),
                disposedAt: String(r.disposedAt ?? ''),
                disposedBy: String(r.disposedBy ?? ''),
              } as const;
            });
          return auditLogOk(entries);
        },
        toRetentionPolicyError,
      ),
    ),
};
