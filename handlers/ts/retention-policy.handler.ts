// @migrated dsl-constructs 2026-03-18
// ============================================================
// RetentionPolicy Handler
//
// Govern how long versions and records must be kept and when they
// may be disposed, including legal hold suspension of normal
// disposition. A record under active legal hold can never be
// disposed regardless of retention period expiration.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

/** Convert retention period to milliseconds for comparison */
function periodToMs(period: number, unit: string): number {
  switch (unit) {
    case 'seconds': return period * 1000;
    case 'minutes': return period * 60 * 1000;
    case 'hours': return period * 60 * 60 * 1000;
    case 'days': return period * 24 * 60 * 60 * 1000;
    case 'weeks': return period * 7 * 24 * 60 * 60 * 1000;
    case 'months': return period * 30 * 24 * 60 * 60 * 1000;
    case 'years': return period * 365 * 24 * 60 * 60 * 1000;
    default: return period * 24 * 60 * 60 * 1000;
  }
}

/** Check if a record identifier matches a hold scope pattern */
function matchesScope(record: string, scope: string): boolean {
  const escaped = scope.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(record);
}

const _handler: FunctionalConceptHandler = {
  setRetention(input: Record<string, unknown>) {
    const recordType = input.recordType as string;
    const period = input.period as number;
    const unit = input.unit as string;
    const dispositionAction = input.dispositionAction as string;

    let p = createProgram();
    p = find(p, 'retention-policy', { recordType }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length > 0) {
        return { variant: 'alreadyExists', message: `A policy already exists for record type '${recordType}'` };
      }
      const policyId = nextId('retention-policy');
      return { policyId };
    }) as StorageProgram<Result>;
  },

  applyHold(input: Record<string, unknown>) {
    const name = input.name as string;
    const scope = input.scope as string;
    const reason = input.reason as string;
    const issuer = input.issuer as string;

    const holdId = nextId('hold');
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'retention-hold', holdId, {
      id: holdId,
      name,
      scope,
      reason,
      issuer,
      issued: now,
      released: null,
    });

    return complete(p, 'ok', { holdId }) as StorageProgram<Result>;
  },

  releaseHold(input: Record<string, unknown>) {
    const holdId = input.holdId as string;
    const releasedBy = input.releasedBy as string;
    const reason = input.reason as string;

    let p = createProgram();
    p = get(p, 'retention-hold', holdId, 'hold');

    return branch(p, 'hold',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const hold = bindings.hold as Record<string, unknown>;
          if (hold.released !== null && hold.released !== undefined) {
            return { variant: 'alreadyReleased', message: `Hold '${holdId}' was already released` };
          }
          return {};
        });
      },
      (elseP) => complete(elseP, 'notFound', { message: `Hold '${holdId}' not found` }),
    ) as StorageProgram<Result>;
  },

  checkDisposition(input: Record<string, unknown>) {
    const record = input.record as string;

    let p = createProgram();
    p = find(p, 'retention-hold', {}, 'allHolds');
    p = find(p, 'retention-policy', {}, 'allPolicies');

    return completeFrom(p, 'ok', (bindings) => {
      const allHolds = bindings.allHolds as Record<string, unknown>[];
      const activeHoldNames: string[] = [];
      for (const hold of allHolds) {
        if (hold.released === null || hold.released === undefined) {
          if (matchesScope(record, hold.scope as string)) {
            activeHoldNames.push(hold.name as string);
          }
        }
      }

      if (activeHoldNames.length > 0) {
        return { variant: 'held', holdNames: activeHoldNames };
      }

      const allPolicies = bindings.allPolicies as Record<string, unknown>[];
      let matchingPolicy: Record<string, unknown> | null = null;

      for (const policy of allPolicies) {
        const recordType = policy.recordType as string;
        if (record.startsWith(recordType)) {
          matchingPolicy = policy;
          break;
        }
      }

      if (!matchingPolicy) {
        return { variant: 'disposable', policyId: '' };
      }

      const periodMs = periodToMs(
        matchingPolicy.retentionPeriod as number,
        matchingPolicy.unit as string,
      );
      const created = new Date(matchingPolicy.created as string).getTime();
      const now = Date.now();

      if (now - created < periodMs) {
        const until = new Date(created + periodMs).toISOString();
        return {
          variant: 'retained',
          reason: `Within retention period for '${matchingPolicy.recordType}'`,
          until,
        };
      }

      return { variant: 'disposable', policyId: matchingPolicy.id as string };
    }) as StorageProgram<Result>;
  },

  dispose(input: Record<string, unknown>) {
    const record = input.record as string;
    const disposedBy = input.disposedBy as string;

    let p = createProgram();
    p = find(p, 'retention-hold', {}, 'allHolds');
    p = find(p, 'retention-policy', {}, 'allPolicies');

    return completeFrom(p, 'ok', (bindings) => {
      const allHolds = bindings.allHolds as Record<string, unknown>[];
      const activeHoldNames: string[] = [];
      for (const hold of allHolds) {
        if (hold.released === null || hold.released === undefined) {
          if (matchesScope(record, hold.scope as string)) {
            activeHoldNames.push(hold.name as string);
          }
        }
      }

      if (activeHoldNames.length > 0) {
        return { variant: 'held', holdNames: activeHoldNames };
      }

      const allPolicies = bindings.allPolicies as Record<string, unknown>[];
      let matchingPolicy: Record<string, unknown> | null = null;

      for (const policy of allPolicies) {
        const recordType = policy.recordType as string;
        if (record.startsWith(recordType)) {
          matchingPolicy = policy;
          break;
        }
      }

      if (matchingPolicy) {
        const periodMs = periodToMs(
          matchingPolicy.retentionPeriod as number,
          matchingPolicy.unit as string,
        );
        const created = new Date(matchingPolicy.created as string).getTime();
        const now = Date.now();

        if (now - created < periodMs) {
          return {
            variant: 'retained',
            reason: `Retention period not yet elapsed for '${matchingPolicy.recordType}'`,
          };
        }
      }

      return {};
    }) as StorageProgram<Result>;
  },

  auditLog(input: Record<string, unknown>) {
    const record = input.record as string | null | undefined;

    let p = createProgram();
    if (record) {
      p = find(p, 'retention-disposition-log', { record }, 'entries');
    } else {
      p = find(p, 'retention-disposition-log', {}, 'entries');
    }

    return completeFrom(p, 'ok', (bindings) => {
      const entries = bindings.entries as Record<string, unknown>[];
      const formatted = entries.map(e => ({
        record: e.record as string,
        policy: e.policy as string,
        disposedAt: e.disposedAt as string,
        disposedBy: e.disposedBy as string,
      }));

      return { entries: formatted };
    }) as StorageProgram<Result>;
  },
};

export const retentionPolicyHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetRetentionPolicyCounter(): void {
  idCounter = 0;
}
