// ============================================================
// Lockfile Concept Conformance Tests
//
// Serialized resolved dependency graph. Validates write, read,
// verify, and diff actions against the concept spec's action
// outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  lockfileHandler,
  resetLockfileIds,
} from '../handlers/ts/lockfile.handler.js';

describe('Lockfile', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  /** Returns fresh entry objects to avoid cross-test mutation. */
  function makeSampleEntries() {
    return [
      {
        module_id: 'auth',
        version: '1.0.0',
        content_hash: 'sha256:aaa',
        artifact_url: 'https://registry.example/auth-1.0.0.tar.gz',
        integrity: 'sha256:integ-aaa',
        features_enabled: ['sso'],
        dependencies: ['logging'],
      },
      {
        module_id: 'logging',
        version: '2.1.0',
        content_hash: 'sha256:bbb',
        artifact_url: 'https://registry.example/logging-2.1.0.tar.gz',
        integrity: 'sha256:integ-bbb',
        features_enabled: [],
        dependencies: [],
      },
    ];
  }

  function makeSampleMetadata() {
    return {
      resolver_version: '1.0.0',
      resolved_at: '2026-03-01T00:00:00Z',
      registry_snapshot: 'snap-001',
    };
  }

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetLockfileIds();
  });

  describe('write', () => {
    it('returns ok when writing valid lockfile entries', async () => {
      const result = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.lockfile).toBe('lock-1');
    });

    it('returns error when entries contain self-referencing dependencies', async () => {
      const result = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: [
            {
              module_id: 'circular',
              version: '1.0.0',
              content_hash: 'sha256:ccc',
              artifact_url: 'https://registry.example/circular.tar.gz',
              integrity: 'sha256:integ-ccc',
              features_enabled: [],
              dependencies: ['circular'],
            },
          ],
          metadata: makeSampleMetadata(),
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Circular');
    });

    it('returns error when an entry has an invalid content_hash', async () => {
      const result = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: [
            {
              module_id: 'badhash',
              version: '1.0.0',
              content_hash: 'nocolon',
              artifact_url: 'https://registry.example/bad.tar.gz',
              integrity: 'sha256:integ-bad',
              features_enabled: [],
              dependencies: [],
            },
          ],
          metadata: makeSampleMetadata(),
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('content_hash');
    });
  });

  describe('read', () => {
    it('returns ok with full lockfile contents after write', async () => {
      const writeResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const result = await lockfileHandler.read!(
        { lockfile: writeResult.lockfile },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.project_hash).toBe('hash-001');
      const entries = result.entries as Array<{ module_id: string }>;
      expect(entries.length).toBe(2);
    });

    it('returns notfound when lockfile does not exist', async () => {
      const result = await lockfileHandler.read!(
        { lockfile: 'lock-999' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns corrupt when lockfile entries are malformed', async () => {
      // Manually insert a corrupted lockfile entry
      await storage.put('lockfile', 'lock-bad', {
        lockfileId: 'lock-bad',
        projectHash: 'hash-bad',
        entries: null,
        metadata: makeSampleMetadata(),
        lockfileHash: 'sha256:fake',
      });

      const result = await lockfileHandler.read!(
        { lockfile: 'lock-bad' },
        storage,
      );
      expect(result.variant).toBe('corrupt');
    });
  });

  describe('verify', () => {
    it('returns ok when lockfile integrity is valid', async () => {
      const writeResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const result = await lockfileHandler.verify!(
        { lockfile: writeResult.lockfile },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns stale when manifest hash has changed', async () => {
      const writeResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const result = await lockfileHandler.verify!(
        {
          lockfile: writeResult.lockfile,
          current_manifest_hash: 'hash-002-changed',
        },
        storage,
      );
      expect(result.variant).toBe('stale');
      expect(result.reason).toContain('Manifest has changed');
    });

    it('returns tampered when integrity data is missing from entries', async () => {
      // Write a lockfile then corrupt its entries
      const writeResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-001',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      // Tamper with the stored lockfile by removing integrity from an entry
      const stored = await storage.get('lockfile', writeResult.lockfile as string);
      const entries = stored!.entries as Array<Record<string, unknown>>;
      entries[0].integrity = '';
      entries[0].content_hash = '';
      // Also change lockfileHash to trigger hash mismatch
      await storage.put('lockfile', writeResult.lockfile as string, {
        ...stored,
        entries,
        lockfileHash: 'sha256:tampered',
      });

      const result = await lockfileHandler.verify!(
        { lockfile: writeResult.lockfile },
        storage,
      );
      expect(result.variant).toBe('tampered');
    });
  });

  describe('diff', () => {
    it('returns ok with added, removed, and updated modules', async () => {
      const oldResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-old',
          entries: [
            { module_id: 'auth', version: '1.0.0', content_hash: 'sha256:a1', artifact_url: 'url1', integrity: 'sha256:i1', features_enabled: [], dependencies: [] },
            { module_id: 'removed-mod', version: '1.0.0', content_hash: 'sha256:r1', artifact_url: 'url2', integrity: 'sha256:i2', features_enabled: [], dependencies: [] },
          ],
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const newResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-new',
          entries: [
            { module_id: 'auth', version: '1.1.0', content_hash: 'sha256:a2', artifact_url: 'url1', integrity: 'sha256:i3', features_enabled: [], dependencies: [] },
            { module_id: 'new-mod', version: '1.0.0', content_hash: 'sha256:n1', artifact_url: 'url3', integrity: 'sha256:i4', features_enabled: [], dependencies: [] },
          ],
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const result = await lockfileHandler.diff!(
        { old_lockfile: oldResult.lockfile, new_lockfile: newResult.lockfile },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.added).toContain('new-mod');
      expect(result.removed).toContain('removed-mod');
      const updated = result.updated as Array<{ module_id: string; old_version: string; new_version: string }>;
      expect(updated.length).toBe(1);
      expect(updated[0].module_id).toBe('auth');
      expect(updated[0].old_version).toBe('1.0.0');
      expect(updated[0].new_version).toBe('1.1.0');
    });
  });

  describe('multi-step sequences', () => {
    it('round-trips through write then read with identical content', async () => {
      const writeResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-round',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const readResult = await lockfileHandler.read!(
        { lockfile: writeResult.lockfile },
        storage,
      );
      expect(readResult.variant).toBe('ok');
      expect(readResult.project_hash).toBe('hash-round');
      const readEntries = readResult.entries as Array<{ module_id: string }>;
      expect(readEntries.length).toBe(2);
    });

    it('passes verification after write', async () => {
      const writeResult = await lockfileHandler.write!(
        {
          project_hash: 'hash-verify',
          entries: makeSampleEntries(),
          metadata: makeSampleMetadata(),
        },
        storage,
      );

      const verifyResult = await lockfileHandler.verify!(
        { lockfile: writeResult.lockfile },
        storage,
      );
      expect(verifyResult.variant).toBe('ok');
    });
  });
});
