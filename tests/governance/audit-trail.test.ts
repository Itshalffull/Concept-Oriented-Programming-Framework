// ============================================================
// AuditTrail Concept Conformance Tests
//
// Tests for append-only audit log: record events with
// hash-chain integrity.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { auditTrailHandler } from '../../handlers/ts/app/governance/audit-trail.handler.js';

describe('AuditTrail Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('record', () => {
    it('creates an audit entry', async () => {
      const result = await auditTrailHandler.record(
        {
          eventType: 'execution_completed',
          actor: 'governance_executor',
          action: 'execute',
          details: 'transfer(100)',
          sourceRef: 'exec-1',
        },
        storage,
      );
      expect(result.variant).toBe('recorded');
      expect(result.entry).toBeTruthy();
    });

    it('records multiple distinct entries', async () => {
      const r1 = await auditTrailHandler.record(
        { eventType: 'first', actor: 'a', action: 'x', details: 'detail-1', sourceRef: 'src-1' },
        storage,
      );
      expect(r1.variant).toBe('recorded');

      const r2 = await auditTrailHandler.record(
        { eventType: 'second', actor: 'b', action: 'y', details: 'detail-2', sourceRef: 'src-2' },
        storage,
      );
      expect(r2.variant).toBe('recorded');
    });
  });

  describe('query', () => {
    it('returns results (stub)', async () => {
      const result = await auditTrailHandler.query({}, storage);
      expect(result.variant).toBe('results');
    });
  });

  describe('verifyIntegrity', () => {
    it('validates chain integrity (stub)', async () => {
      const result = await auditTrailHandler.verifyIntegrity({}, storage);
      expect(result.variant).toBe('valid');
    });
  });
});
