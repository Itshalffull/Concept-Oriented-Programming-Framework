// TemporalVersion concept handler tests -- record, asOf, between, current, and supersede.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { temporalVersionHandler, resetTemporalVersionCounter } from '../handlers/ts/temporal-version.handler.js';

describe('TemporalVersion', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTemporalVersionCounter();
  });

  describe('record', () => {
    it('records a new version', async () => {
      const result = await temporalVersionHandler.record(
        { contentHash: 'hash-1', metadata: 'initial' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.versionId).toBe('temporal-version-1');
    });

    it('records a version with valid time bounds', async () => {
      const result = await temporalVersionHandler.record(
        { contentHash: 'hash-1', validFrom: '2024-01-01T00:00:00Z', validTo: '2024-12-31T23:59:59Z', metadata: 'bounded' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('closes system time on previous version when recording new one', async () => {
      const v1 = await temporalVersionHandler.record({ contentHash: 'hash-1', metadata: 'v1' }, storage);
      const v1Id = v1.versionId as string;

      await temporalVersionHandler.record({ contentHash: 'hash-2', metadata: 'v2' }, storage);

      // v1 should now have systemTo set
      const v1Record = await storage.get('temporal-version', v1Id);
      expect(v1Record!.systemTo).not.toBeNull();
    });
  });

  describe('current', () => {
    it('returns the most recently recorded version', async () => {
      await temporalVersionHandler.record({ contentHash: 'hash-1', metadata: 'first' }, storage);
      await temporalVersionHandler.record({ contentHash: 'hash-2', metadata: 'second' }, storage);

      const result = await temporalVersionHandler.current({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.contentHash).toBe('hash-2');
    });

    it('returns empty when no versions exist', async () => {
      const result = await temporalVersionHandler.current({}, storage);
      expect(result.variant).toBe('empty');
    });
  });

  describe('asOf', () => {
    it('finds version active at a given system time', async () => {
      const v1 = await temporalVersionHandler.record({ contentHash: 'hash-1', metadata: 'v1' }, storage);
      const v1Record = await storage.get('temporal-version', v1.versionId as string);
      const v1SystemFrom = v1Record!.systemFrom as string;

      // Create a time slightly after v1 was created but before any v2
      const result = await temporalVersionHandler.asOf({ systemTime: v1SystemFrom }, storage);
      expect(result.variant).toBe('ok');
      expect(result.contentHash).toBe('hash-1');
    });

    it('returns notFound for time before any version', async () => {
      await temporalVersionHandler.record({ contentHash: 'hash-1', metadata: 'v1' }, storage);

      const result = await temporalVersionHandler.asOf({ systemTime: '1970-01-01T00:00:00Z' }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('filters by valid time dimension', async () => {
      await temporalVersionHandler.record(
        { contentHash: 'hash-1', validFrom: '2024-01-01T00:00:00Z', validTo: '2024-06-30T23:59:59Z', metadata: 'H1' },
        storage,
      );
      await temporalVersionHandler.record(
        { contentHash: 'hash-2', validFrom: '2024-07-01T00:00:00Z', validTo: '2024-12-31T23:59:59Z', metadata: 'H2' },
        storage,
      );

      const result = await temporalVersionHandler.asOf({ validTime: '2024-03-15T00:00:00Z' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.contentHash).toBe('hash-1');
    });
  });

  describe('between', () => {
    it('finds versions within a system time range', async () => {
      await temporalVersionHandler.record({ contentHash: 'h1', metadata: 'v1' }, storage);
      await temporalVersionHandler.record({ contentHash: 'h2', metadata: 'v2' }, storage);
      await temporalVersionHandler.record({ contentHash: 'h3', metadata: 'v3' }, storage);

      const result = await temporalVersionHandler.between(
        { start: '2000-01-01T00:00:00Z', end: '2099-12-31T23:59:59Z', dimension: 'system' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.versions as string[]).length).toBeGreaterThanOrEqual(3);
    });

    it('returns invalidDimension for bad dimension', async () => {
      const result = await temporalVersionHandler.between(
        { start: '2024-01-01', end: '2024-12-31', dimension: 'bad' },
        storage,
      );
      expect(result.variant).toBe('invalidDimension');
    });

    it('filters by valid time dimension', async () => {
      await temporalVersionHandler.record(
        { contentHash: 'h1', validFrom: '2024-01-01T00:00:00Z', validTo: '2024-06-30T23:59:59Z', metadata: 'H1' },
        storage,
      );

      const result = await temporalVersionHandler.between(
        { start: '2024-03-01T00:00:00Z', end: '2024-04-01T00:00:00Z', dimension: 'valid' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.versions as string[]).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('supersede', () => {
    it('supersedes an existing version with new content', async () => {
      const v1 = await temporalVersionHandler.record({ contentHash: 'hash-1', metadata: 'v1' }, storage);

      const result = await temporalVersionHandler.supersede(
        { versionId: v1.versionId as string, contentHash: 'hash-1-corrected' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.newVersionId).toBeDefined();

      // Current should now be the superseded version
      const current = await temporalVersionHandler.current({}, storage);
      expect(current.contentHash).toBe('hash-1-corrected');
    });

    it('closes system time on the original version', async () => {
      const v1 = await temporalVersionHandler.record({ contentHash: 'hash-1', metadata: 'v1' }, storage);
      const v1Id = v1.versionId as string;

      await temporalVersionHandler.supersede({ versionId: v1Id, contentHash: 'hash-1-fix' }, storage);

      const v1Record = await storage.get('temporal-version', v1Id);
      expect(v1Record!.systemTo).not.toBeNull();
    });

    it('returns notFound for unknown version', async () => {
      const result = await temporalVersionHandler.supersede(
        { versionId: 'nonexistent', contentHash: 'x' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });
});
