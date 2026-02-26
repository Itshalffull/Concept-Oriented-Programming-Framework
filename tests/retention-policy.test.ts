// RetentionPolicy concept handler tests -- setRetention, applyHold, releaseHold,
// checkDisposition, dispose, and auditLog.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { retentionPolicyHandler, resetRetentionPolicyCounter } from '../implementations/typescript/retention-policy.impl.js';

describe('RetentionPolicy', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRetentionPolicyCounter();
  });

  describe('setRetention', () => {
    it('creates a retention policy for a record type', async () => {
      const result = await retentionPolicyHandler.setRetention(
        { recordType: 'audit-log', period: 7, unit: 'years', dispositionAction: 'archive' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.policyId).toBeDefined();
    });

    it('rejects duplicate policy for same record type', async () => {
      await retentionPolicyHandler.setRetention(
        { recordType: 'audit-log', period: 7, unit: 'years', dispositionAction: 'archive' },
        storage,
      );
      const result = await retentionPolicyHandler.setRetention(
        { recordType: 'audit-log', period: 5, unit: 'years', dispositionAction: 'delete' },
        storage,
      );
      expect(result.variant).toBe('alreadyExists');
    });
  });

  describe('applyHold', () => {
    it('creates a legal hold on a scope', async () => {
      const result = await retentionPolicyHandler.applyHold(
        { name: 'matter-123', scope: 'matter:123/*', reason: 'Litigation', issuer: 'legal-dept' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.holdId).toBeDefined();
    });
  });

  describe('releaseHold', () => {
    it('releases an active hold', async () => {
      const hold = await retentionPolicyHandler.applyHold(
        { name: 'matter-123', scope: 'matter:123/*', reason: 'Litigation', issuer: 'legal-dept' },
        storage,
      );
      const holdId = hold.holdId as string;

      const result = await retentionPolicyHandler.releaseHold(
        { holdId, releasedBy: 'counsel', reason: 'Matter settled' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns alreadyReleased for double-release', async () => {
      const hold = await retentionPolicyHandler.applyHold(
        { name: 'matter-123', scope: 'matter:123/*', reason: 'Litigation', issuer: 'legal-dept' },
        storage,
      );
      const holdId = hold.holdId as string;

      await retentionPolicyHandler.releaseHold({ holdId, releasedBy: 'counsel', reason: 'Done' }, storage);
      const result = await retentionPolicyHandler.releaseHold(
        { holdId, releasedBy: 'counsel', reason: 'Again' },
        storage,
      );
      expect(result.variant).toBe('alreadyReleased');
    });

    it('returns notFound for unknown hold ID', async () => {
      const result = await retentionPolicyHandler.releaseHold(
        { holdId: 'nonexistent', releasedBy: 'x', reason: 'y' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });

  describe('checkDisposition', () => {
    it('returns held when an active hold covers the record', async () => {
      await retentionPolicyHandler.applyHold(
        { name: 'matter-123', scope: 'matter:123/*', reason: 'Litigation', issuer: 'legal-dept' },
        storage,
      );

      const result = await retentionPolicyHandler.checkDisposition(
        { record: 'matter:123/doc-1' },
        storage,
      );
      expect(result.variant).toBe('held');
      expect((result.holdNames as string[]).length).toBe(1);
    });

    it('returns disposable when no policy and no hold exist', async () => {
      const result = await retentionPolicyHandler.checkDisposition(
        { record: 'orphan-record' },
        storage,
      );
      expect(result.variant).toBe('disposable');
    });

    it('returns disposable after hold is released', async () => {
      const hold = await retentionPolicyHandler.applyHold(
        { name: 'matter-123', scope: 'matter:123/*', reason: 'Litigation', issuer: 'legal-dept' },
        storage,
      );
      await retentionPolicyHandler.releaseHold(
        { holdId: hold.holdId as string, releasedBy: 'counsel', reason: 'Done' },
        storage,
      );

      const result = await retentionPolicyHandler.checkDisposition(
        { record: 'matter:123/doc-1' },
        storage,
      );
      expect(result.variant).toBe('disposable');
    });
  });

  describe('dispose', () => {
    it('disposes a record with no holds and no retention', async () => {
      const result = await retentionPolicyHandler.dispose(
        { record: 'temp-record', disposedBy: 'janitor' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects disposal when a hold is active', async () => {
      await retentionPolicyHandler.applyHold(
        { name: 'hold-1', scope: 'matter:*', reason: 'Litigation', issuer: 'legal' },
        storage,
      );

      const result = await retentionPolicyHandler.dispose(
        { record: 'matter:456', disposedBy: 'janitor' },
        storage,
      );
      expect(result.variant).toBe('held');
    });
  });

  describe('auditLog', () => {
    it('returns disposition log entries', async () => {
      await retentionPolicyHandler.dispose({ record: 'rec-1', disposedBy: 'admin' }, storage);
      await retentionPolicyHandler.dispose({ record: 'rec-2', disposedBy: 'admin' }, storage);

      const result = await retentionPolicyHandler.auditLog({}, storage);
      expect(result.variant).toBe('ok');
      expect((result.entries as unknown[]).length).toBe(2);
    });

    it('filters audit log by record', async () => {
      await retentionPolicyHandler.dispose({ record: 'rec-1', disposedBy: 'admin' }, storage);
      await retentionPolicyHandler.dispose({ record: 'rec-2', disposedBy: 'admin' }, storage);

      const result = await retentionPolicyHandler.auditLog({ record: 'rec-1' }, storage);
      expect(result.variant).toBe('ok');
      expect((result.entries as unknown[]).length).toBe(1);
    });

    it('returns empty entries when no dispositions exist', async () => {
      const result = await retentionPolicyHandler.auditLog({}, storage);
      expect(result.variant).toBe('ok');
      expect((result.entries as unknown[]).length).toBe(0);
    });
  });

  describe('hold scope pattern matching', () => {
    it('matches glob patterns in scope', async () => {
      await retentionPolicyHandler.applyHold(
        { name: 'broad-hold', scope: 'project:*', reason: 'Audit', issuer: 'compliance' },
        storage,
      );

      const r1 = await retentionPolicyHandler.checkDisposition({ record: 'project:alpha' }, storage);
      expect(r1.variant).toBe('held');

      const r2 = await retentionPolicyHandler.checkDisposition({ record: 'other:beta' }, storage);
      expect(r2.variant).toBe('disposable');
    });
  });
});
