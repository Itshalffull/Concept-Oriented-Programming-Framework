// ============================================================
// TargetProfile Concept Conformance Tests
//
// Declare the technology dimensions for a project: languages,
// frameworks, deploy targets, and more. Validates create,
// setBackendLanguages, setFrontendFrameworks, setApiInterfaces,
// setDeployTargets, validate, deriveModules, and listOptions
// actions against the concept spec's action outcomes.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  targetProfileHandler,
  resetTargetProfileIds,
} from '../handlers/ts/target-profile.handler.js';

describe('TargetProfile', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTargetProfileIds();
  });

  describe('create', () => {
    it('creates an empty profile and returns ok', async () => {
      const result = await targetProfileHandler.create!(
        { name: 'my-project' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.profileId).toBe('profile-1');
    });

    it('returns duplicate for an existing profile name', async () => {
      await targetProfileHandler.create!({ name: 'dup' }, storage);
      const result = await targetProfileHandler.create!(
        { name: 'dup' },
        storage,
      );
      expect(result.variant).toBe('duplicate');
      expect(result.message).toContain('dup');
    });
  });

  describe('setBackendLanguages', () => {
    it('sets valid backend languages', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.setBackendLanguages!(
        { profileId: created.profileId, values: JSON.stringify(['typescript', 'rust']) },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects invalid backend languages', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.setBackendLanguages!(
        { profileId: created.profileId, values: JSON.stringify(['cobol']) },
        storage,
      );
      expect(result.variant).toBe('invalid');
      const errors = JSON.parse(result.errors as string);
      expect(errors[0]).toContain('cobol');
    });
  });

  describe('setFrontendFrameworks', () => {
    it('sets valid frontend frameworks', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.setFrontendFrameworks!(
        { profileId: created.profileId, values: JSON.stringify(['react', 'vue']) },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects invalid frontend frameworks', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.setFrontendFrameworks!(
        { profileId: created.profileId, values: JSON.stringify(['angular']) },
        storage,
      );
      expect(result.variant).toBe('invalid');
      const errors = JSON.parse(result.errors as string);
      expect(errors[0]).toContain('angular');
    });
  });

  describe('setApiInterfaces', () => {
    it('sets valid API interfaces', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.setApiInterfaces!(
        { profileId: created.profileId, values: JSON.stringify(['rest', 'graphql']) },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  describe('setDeployTargets', () => {
    it('sets valid deploy targets', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.setDeployTargets!(
        { profileId: created.profileId, values: JSON.stringify(['vercel', 'lambda']) },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  describe('validate', () => {
    it('returns ok when at least backend languages are set', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      await targetProfileHandler.setBackendLanguages!(
        { profileId: created.profileId, values: JSON.stringify(['typescript']) },
        storage,
      );
      const result = await targetProfileHandler.validate!(
        { profileId: created.profileId },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns incomplete when no backend languages are set', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.validate!(
        { profileId: created.profileId },
        storage,
      );
      expect(result.variant).toBe('incomplete');
      const errors = JSON.parse(result.errors as string);
      expect(errors[0]).toContain('backend language');
    });

    it('reports warnings for incompatible combos (SwiftUI + Vercel)', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      await targetProfileHandler.setBackendLanguages!(
        { profileId: created.profileId, values: JSON.stringify(['swift']) },
        storage,
      );
      await targetProfileHandler.setFrontendFrameworks!(
        { profileId: created.profileId, values: JSON.stringify(['swiftui']) },
        storage,
      );
      await targetProfileHandler.setDeployTargets!(
        { profileId: created.profileId, values: JSON.stringify(['vercel']) },
        storage,
      );
      const result = await targetProfileHandler.validate!(
        { profileId: created.profileId },
        storage,
      );
      expect(result.variant).toBe('ok');
      const warnings = JSON.parse(result.warnings as string);
      expect(warnings.some((w: string) => w.includes('SwiftUI'))).toBe(true);
    });
  });

  describe('deriveModules', () => {
    it('returns infrastructure modules matching the profile', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      await targetProfileHandler.setDeployTargets!(
        { profileId: created.profileId, values: JSON.stringify(['vercel', 'k8s']) },
        storage,
      );
      await targetProfileHandler.setApiInterfaces!(
        { profileId: created.profileId, values: JSON.stringify(['rest']) },
        storage,
      );
      const result = await targetProfileHandler.deriveModules!(
        { profileId: created.profileId },
        storage,
      );
      expect(result.variant).toBe('ok');
      const modules = JSON.parse(result.modules as string);
      expect(modules).toContain('VercelRuntime');
      expect(modules).toContain('K8sRuntime');
      expect(modules).toContain('RestTarget');
      expect(modules).toContain('OpenApiSpec');
    });

    it('returns empty modules when profile has no deploy or API targets', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'proj' },
        storage,
      );
      const result = await targetProfileHandler.deriveModules!(
        { profileId: created.profileId },
        storage,
      );
      expect(result.variant).toBe('ok');
      const modules = JSON.parse(result.modules as string);
      expect(modules.length).toBe(0);
    });
  });

  describe('listOptions', () => {
    it('returns all dimensions with their supported options', async () => {
      const result = await targetProfileHandler.listOptions!({}, storage);
      expect(result.variant).toBe('ok');
      const options = JSON.parse(result.options as string);
      expect(options.backend_languages).toContain('typescript');
      expect(options.frontend_frameworks).toContain('react');
      expect(options.api_interfaces).toContain('rest');
      expect(options.deploy_targets).toContain('vercel');
      expect(options.storage_adapters).toContain('postgres');
      expect(options.transport_adapters).toContain('http');
    });
  });

  describe('multi-step sequences', () => {
    it('create then set languages then validate succeeds', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'full-stack' },
        storage,
      );
      expect(created.variant).toBe('ok');

      await targetProfileHandler.setBackendLanguages!(
        { profileId: created.profileId, values: JSON.stringify(['typescript']) },
        storage,
      );
      await targetProfileHandler.setFrontendFrameworks!(
        { profileId: created.profileId, values: JSON.stringify(['react']) },
        storage,
      );
      await targetProfileHandler.setDeployTargets!(
        { profileId: created.profileId, values: JSON.stringify(['vercel']) },
        storage,
      );

      const validation = await targetProfileHandler.validate!(
        { profileId: created.profileId },
        storage,
      );
      expect(validation.variant).toBe('ok');
    });

    it('deriveModules reflects storage and transport adapters', async () => {
      const created = await targetProfileHandler.create!(
        { name: 'backend' },
        storage,
      );
      await targetProfileHandler.setBackendLanguages!(
        { profileId: created.profileId, values: JSON.stringify(['typescript']) },
        storage,
      );
      await targetProfileHandler.setStorageAdapters!(
        { profileId: created.profileId, values: JSON.stringify(['postgres', 'sqlite']) },
        storage,
      );
      await targetProfileHandler.setTransportAdapters!(
        { profileId: created.profileId, values: JSON.stringify(['http', 'ws']) },
        storage,
      );

      const derived = await targetProfileHandler.deriveModules!(
        { profileId: created.profileId },
        storage,
      );
      expect(derived.variant).toBe('ok');
      const modules = JSON.parse(derived.modules as string);
      expect(modules).toContain('PostgresAdapter');
      expect(modules).toContain('SqliteAdapter');
      expect(modules).toContain('HttpTransport');
      expect(modules).toContain('WsTransport');
    });
  });
});
