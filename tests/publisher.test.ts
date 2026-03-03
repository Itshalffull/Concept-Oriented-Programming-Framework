// ============================================================
// Publisher Concept Conformance Tests
//
// Package and upload modules to a registry. Validates package,
// sign, attest, generateSbom, and upload actions against the
// concept spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  publisherHandler,
  resetPublisherIds,
} from '../handlers/ts/publisher.handler.js';

describe('Publisher', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const validManifest = {
    module_id: 'auth',
    version: '1.0.0',
    dependencies: ['logging'],
  };

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetPublisherIds();
  });

  describe('package', () => {
    it('returns ok when packaging a valid source', async () => {
      const result = await publisherHandler.package!(
        {
          source_path: '/src/auth',
          kind: 'library',
          manifest: validManifest,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.publication).toBe('pub-1');
    });

    it('returns invalid when manifest module_id is missing', async () => {
      const result = await publisherHandler.package!(
        {
          source_path: '/src/auth',
          kind: 'library',
          manifest: { module_id: '', version: '1.0.0', dependencies: [] },
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });

    it('returns invalid when kind is unsupported', async () => {
      const result = await publisherHandler.package!(
        {
          source_path: '/src/auth',
          kind: 'widget',
          manifest: validManifest,
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });

    it('stores publication with status packaged', async () => {
      const result = await publisherHandler.package!(
        {
          source_path: '/src/auth',
          kind: 'library',
          manifest: validManifest,
        },
        storage,
      );

      const pub = await storage.get('publication', result.publication as string);
      expect(pub!.status).toBe('packaged');
      expect(pub!.artifact_hash).toBeDefined();
    });
  });

  describe('sign', () => {
    it('returns ok and stores a cryptographic signature', async () => {
      const pkg = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );

      const result = await publisherHandler.sign!(
        { publication: pkg.publication },
        storage,
      );
      expect(result.variant).toBe('ok');

      const pub = await storage.get('publication', pkg.publication as string);
      expect(pub!.signature).toBeDefined();
      expect(pub!.signature).not.toBeNull();
      expect(pub!.status).toBe('signed');
    });

    it('returns error when publication does not exist', async () => {
      const result = await publisherHandler.sign!(
        { publication: 'pub-999' },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });

  describe('attest', () => {
    it('returns ok and stores provenance metadata', async () => {
      const pkg = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );

      const result = await publisherHandler.attest!(
        {
          publication: pkg.publication,
          builder: 'github-actions',
          source_repo: 'https://github.com/clef/auth',
          source_commit: 'abc123def',
        },
        storage,
      );
      expect(result.variant).toBe('ok');

      const pub = await storage.get('publication', pkg.publication as string);
      expect(pub!.provenance).toBeDefined();
      expect(pub!.provenance).not.toBeNull();
      const provenance = JSON.parse(pub!.provenance as string);
      expect(provenance.builder).toBe('github-actions');
      expect(provenance.slsa_level).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateSbom', () => {
    it('returns ok and stores an SBOM document', async () => {
      const pkg = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );

      const result = await publisherHandler.generateSbom!(
        { publication: pkg.publication },
        storage,
      );
      expect(result.variant).toBe('ok');

      const pub = await storage.get('publication', pkg.publication as string);
      expect(pub!.sbom).toBeDefined();
      expect(pub!.sbom).not.toBeNull();

      const sbom = JSON.parse(pub!.sbom as string);
      expect(sbom.spdxVersion).toBe('SPDX-2.3');
      expect(sbom.packages.length).toBeGreaterThan(0);
    });
  });

  describe('upload', () => {
    it('returns ok and sets status to published', async () => {
      const pkg = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );

      const result = await publisherHandler.upload!(
        { publication: pkg.publication, registry_url: 'https://registry.example' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const pub = await storage.get('publication', pkg.publication as string);
      expect(pub!.status).toBe('published');
    });

    it('returns duplicate when same module/version is already published', async () => {
      const first = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );
      await publisherHandler.upload!(
        { publication: first.publication, registry_url: 'https://registry.example' },
        storage,
      );

      const second = await publisherHandler.package!(
        { source_path: '/src/auth-v2', kind: 'library', manifest: validManifest },
        storage,
      );
      const result = await publisherHandler.upload!(
        { publication: second.publication, registry_url: 'https://registry.example' },
        storage,
      );
      expect(result.variant).toBe('duplicate');
    });
  });

  describe('multi-step sequences', () => {
    it('completes full lifecycle: package then sign then upload', async () => {
      const pkg = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );
      expect(pkg.variant).toBe('ok');

      const signed = await publisherHandler.sign!(
        { publication: pkg.publication },
        storage,
      );
      expect(signed.variant).toBe('ok');

      const uploaded = await publisherHandler.upload!(
        { publication: pkg.publication, registry_url: 'https://registry.example' },
        storage,
      );
      expect(uploaded.variant).toBe('ok');

      const pub = await storage.get('publication', pkg.publication as string);
      expect(pub!.status).toBe('published');
      expect(pub!.signature).not.toBeNull();
    });

    it('completes full lifecycle with attestation and SBOM', async () => {
      const pkg = await publisherHandler.package!(
        { source_path: '/src/auth', kind: 'library', manifest: validManifest },
        storage,
      );

      await publisherHandler.sign!({ publication: pkg.publication }, storage);

      await publisherHandler.attest!(
        {
          publication: pkg.publication,
          builder: 'ci',
          source_repo: 'https://github.com/clef/auth',
          source_commit: 'abc123',
        },
        storage,
      );

      await publisherHandler.generateSbom!({ publication: pkg.publication }, storage);

      await publisherHandler.upload!(
        { publication: pkg.publication, registry_url: 'https://registry.example' },
        storage,
      );

      const pub = await storage.get('publication', pkg.publication as string);
      expect(pub!.status).toBe('published');
      expect(pub!.provenance).not.toBeNull();
      expect(pub!.sbom).not.toBeNull();
    });
  });
});
