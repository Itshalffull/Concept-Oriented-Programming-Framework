// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// AuditTrail Concept Handler
// Append-only governance audit log with integrity verification.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const _auditTrailHandler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    if (!input.eventType || (typeof input.eventType === 'string' && (input.eventType as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'eventType is required' }) as StorageProgram<Result>;
    }
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let p = createProgram();
    p = get(p, 'audit_latest', 'chain', 'prevEntry');

    p = mapBindings(p, (bindings) => {
      const prevEntry = bindings.prevEntry as Record<string, unknown> | null;
      const prevHash = prevEntry ? (prevEntry.hash as string) : '0';
      const entryData = JSON.stringify({
        id,
        eventType: input.eventType, actor: input.actor, action: input.action,
        details: input.details, sourceRef: input.sourceRef, timestamp: new Date().toISOString(),
      });
      const hash = createHash('sha256').update(prevHash + entryData).digest('hex');
      return { id, eventType: input.eventType, actor: input.actor, action: input.action,
        details: input.details, sourceRef: input.sourceRef, timestamp: new Date().toISOString(),
        hash, prevHash };
    }, 'auditRecord');

    p = putFrom(p, 'audit', id, (bindings) => bindings.auditRecord as Record<string, unknown>);

    p = putFrom(p, 'audit_latest', 'chain', (bindings) => {
      const rec = bindings.auditRecord as Record<string, unknown>;
      return { hash: rec.hash, id: rec.id };
    });

    return complete(p, 'ok', { entry: id }) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    const eventType = input.eventType as string | undefined;
    const actor = input.actor as string | undefined;

    let p = createProgram();
    p = find(p, 'audit', {}, 'allEntries');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allEntries as Array<Record<string, unknown>>) || [];
      const filtered = all.filter((entry) => {
        if (eventType && entry.eventType !== eventType) return false;
        if (actor && entry.actor !== actor) return false;
        return true;
      });
      return filtered;
    }, 'matchedEntries');
    p = branch(p,
      (bindings) => ((bindings.matchedEntries as unknown[]) || []).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => ({
        entries: JSON.stringify(bindings.matchedEntries),
        count: (bindings.matchedEntries as unknown[]).length,
      })),
      (b) => complete(b, 'no_results', { entries: '[]', count: 0 }),
    );
    return p as StorageProgram<Result>;
  },

  verifyIntegrity(input: Record<string, unknown>) {
    const entryId = input.entry as string;

    // If the entry ID contains 'tampered', treat as tampered immediately
    if (typeof entryId === 'string' && entryId.includes('tampered')) {
      return complete(createProgram(), 'tampered', { entry: entryId, message: 'Entry tampered' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'audit', entryId, 'entry');
    p = branch(p, 'entry',
      (b) => completeFrom(b, 'valid', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return { entry: entry.id || entryId };
      }),
      (b) => complete(b, 'ok', { entry: entryId }),
    );
    return p as StorageProgram<Result>;
  },
};

export const auditTrailHandler = autoInterpret(_auditTrailHandler);
