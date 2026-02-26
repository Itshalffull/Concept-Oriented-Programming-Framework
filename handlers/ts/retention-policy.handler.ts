// ============================================================
// RetentionPolicy Handler
//
// Govern how long versions and records must be kept and when they
// may be disposed, including legal hold suspension of normal
// disposition. A record under active legal hold can never be
// disposed regardless of retention period expiration.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
  // Support simple glob-like matching: "matter:123/*" matches "matter:123/doc-1"
  const escaped = scope.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(record);
}

export const retentionPolicyHandler: ConceptHandler = {
  async setRetention(input: Record<string, unknown>, storage: ConceptStorage) {
    const recordType = input.recordType as string;
    const period = input.period as number;
    const unit = input.unit as string;
    const dispositionAction = input.dispositionAction as string;

    // Check if a policy already exists for this record type
    const existing = await storage.find('retention-policy', { recordType });
    if (existing.length > 0) {
      return { variant: 'alreadyExists', message: `A policy already exists for record type '${recordType}'` };
    }

    const policyId = nextId('retention-policy');
    const now = new Date().toISOString();
    await storage.put('retention-policy', policyId, {
      id: policyId,
      recordType,
      retentionPeriod: period,
      unit,
      dispositionAction,
      created: now,
    });

    return { variant: 'ok', policyId };
  },

  async applyHold(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const scope = input.scope as string;
    const reason = input.reason as string;
    const issuer = input.issuer as string;

    const holdId = nextId('hold');
    const now = new Date().toISOString();

    await storage.put('retention-hold', holdId, {
      id: holdId,
      name,
      scope,
      reason,
      issuer,
      issued: now,
      released: null,
    });

    return { variant: 'ok', holdId };
  },

  async releaseHold(input: Record<string, unknown>, storage: ConceptStorage) {
    const holdId = input.holdId as string;
    const releasedBy = input.releasedBy as string;
    const reason = input.reason as string;

    const hold = await storage.get('retention-hold', holdId);
    if (!hold) {
      return { variant: 'notFound', message: `Hold '${holdId}' not found` };
    }

    if (hold.released !== null && hold.released !== undefined) {
      return { variant: 'alreadyReleased', message: `Hold '${holdId}' was already released` };
    }

    const now = new Date().toISOString();
    await storage.put('retention-hold', holdId, {
      ...hold,
      released: now,
      releasedBy,
      releaseReason: reason,
    });

    return { variant: 'ok' };
  },

  async checkDisposition(input: Record<string, unknown>, storage: ConceptStorage) {
    const record = input.record as string;

    // Check for active holds
    const allHolds = await storage.find('retention-hold', {});
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

    // Find matching policy by record type prefix
    const allPolicies = await storage.find('retention-policy', {});
    let matchingPolicy: Record<string, unknown> | null = null;

    for (const policy of allPolicies) {
      const recordType = policy.recordType as string;
      if (record.startsWith(recordType)) {
        matchingPolicy = policy;
        break;
      }
    }

    if (!matchingPolicy) {
      // No policy means disposable by default
      return { variant: 'disposable', policyId: '' };
    }

    // Check retention period
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
  },

  async dispose(input: Record<string, unknown>, storage: ConceptStorage) {
    const record = input.record as string;
    const disposedBy = input.disposedBy as string;

    // Check for active holds first
    const allHolds = await storage.find('retention-hold', {});
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

    // Check retention period
    const allPolicies = await storage.find('retention-policy', {});
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

    // Log disposition
    const now = new Date().toISOString();
    const logId = nextId('disposition-log');
    await storage.put('retention-disposition-log', logId, {
      id: logId,
      record,
      policy: matchingPolicy ? (matchingPolicy.id as string) : '',
      disposedAt: now,
      disposedBy,
    });

    return { variant: 'ok' };
  },

  async auditLog(input: Record<string, unknown>, storage: ConceptStorage) {
    const record = input.record as string | null | undefined;

    let entries: Record<string, unknown>[];

    if (record) {
      entries = await storage.find('retention-disposition-log', { record });
    } else {
      entries = await storage.find('retention-disposition-log', {});
    }

    const formatted = entries.map(e => ({
      record: e.record as string,
      policy: e.policy as string,
      disposedAt: e.disposedAt as string,
      disposedBy: e.disposedBy as string,
    }));

    return { variant: 'ok', entries: formatted };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetRetentionPolicyCounter(): void {
  idCounter = 0;
}
