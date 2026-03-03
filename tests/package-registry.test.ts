// ============================================================
// Package Registry Concept Conformance Tests
//
// Index of available module metadata. Validates publish, yank,
// lookup, search, listVersions, and resolveCapability actions
// against the concept spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  registryHandler,
  resetRegistryIds,
} from '../handlers/ts/registry.handler.js';

describe('Package Registry', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const validMetadata = {
    description: 'Auth module',
    license: 'MIT',
    repository: 'https://github.com/clef/auth',
    authors: ['alice'],
    keywords: ['auth', 'identity'],
  };

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRegistryIds();
  });

  describe('publish', () => {
    it('returns ok when publishing a valid module', async () => {
      const result = await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:abc123',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.module).toBe('mod-1');
    });

    it('returns duplicate when publishing the same name/namespace/version', async () => {
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:abc123',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      const result = await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:def456',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      expect(result.variant).toBe('duplicate');
    });

    it('returns invalid when artifact hash is malformed', async () => {
      const result = await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'badhash',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('algorithm:digest');
    });

    it('returns invalid when required metadata fields are missing', async () => {
      const result = await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:abc123',
          dependencies: [],
          metadata: { description: '', license: '', repository: '', authors: [], keywords: [] },
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });
  });

  describe('yank', () => {
    it('returns ok when yanking an existing module', async () => {
      const pub = await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:abc',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      const result = await registryHandler.yank!({ module: pub.module }, storage);
      expect(result.variant).toBe('ok');
    });

    it('returns notfound when yanking a non-existent module', async () => {
      const result = await registryHandler.yank!({ module: 'mod-999' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('lookup', () => {
    it('returns ok with matching modules for a version range', async () => {
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:a1',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.1.0',
          kind: 'concept',
          artifact_hash: 'sha256:a2',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );

      const result = await registryHandler.lookup!(
        { name: 'auth', namespace: 'clef', version_range: '^1.0.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const modules = result.modules as string[];
      expect(modules.length).toBe(2);
      // Sorted version descending: 1.1.0 first
      expect(modules[0]).toBe('mod-2');
      expect(modules[1]).toBe('mod-1');
    });

    it('returns notfound when no modules match', async () => {
      const result = await registryHandler.lookup!(
        { name: 'nonexistent', namespace: 'clef', version_range: '^1.0.0' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('search', () => {
    it('returns ok with modules matching a text query', async () => {
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:a1',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );

      const result = await registryHandler.search!(
        { query: 'identity' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const modules = result.modules as string[];
      expect(modules.length).toBe(1);
    });

    it('returns empty list when no modules match the query', async () => {
      const result = await registryHandler.search!(
        { query: 'nonexistent-term' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.modules as string[]).length).toBe(0);
    });
  });

  describe('listVersions', () => {
    it('returns ok with all published versions', async () => {
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:a1',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '2.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:a2',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );

      const result = await registryHandler.listVersions!(
        { name: 'auth', namespace: 'clef' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const versions = result.versions as string[];
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
    });

    it('returns notfound when the module does not exist', async () => {
      const result = await registryHandler.listVersions!(
        { name: 'missing', namespace: 'clef' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('resolveCapability', () => {
    it('returns ok with providers that declare the capability', async () => {
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:a1',
          dependencies: [],
          metadata: validMetadata,
          capabilities_provided: ['identity', 'sso'],
        },
        storage,
      );

      const result = await registryHandler.resolveCapability!(
        { capability: 'identity' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.providers as string[]).length).toBe(1);
    });

    it('returns notfound when no module provides the capability', async () => {
      const result = await registryHandler.resolveCapability!(
        { capability: 'nonexistent-cap' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('multi-step sequences', () => {
    it('returns published module via lookup after publish', async () => {
      await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:abc',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );

      const result = await registryHandler.lookup!(
        { name: 'auth', namespace: 'clef', version_range: '^1.0.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.modules as string[]).length).toBe(1);
    });

    it('excludes yanked module from lookup results', async () => {
      const pub = await registryHandler.publish!(
        {
          name: 'auth',
          namespace: 'clef',
          version: '1.0.0',
          kind: 'concept',
          artifact_hash: 'sha256:abc',
          dependencies: [],
          metadata: validMetadata,
        },
        storage,
      );

      await registryHandler.yank!({ module: pub.module }, storage);

      const result = await registryHandler.lookup!(
        { name: 'auth', namespace: 'clef', version_range: '^1.0.0' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });
});
