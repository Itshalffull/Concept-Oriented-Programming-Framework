// ============================================================
// EnvironmentEntity Handler Tests
//
// Tests for environment config registration, retrieval,
// environment/concept/runtime queries, cross-environment diff,
// secrets audit, and feature flag listing.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { environmentEntityHandler } from '../handlers/ts/score/environment-entity.handler.js';

describe('EnvironmentEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new config entry', async () => {
      const result = await environmentEntityHandler.register(
        { name: 'DATABASE_URL', environment: 'production', kind: 'config', value: 'postgres://...', source: 'env-file' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entry).toBeDefined();
    });

    it('returns updated for existing entry', async () => {
      await environmentEntityHandler.register(
        { name: 'DATABASE_URL', environment: 'production', kind: 'config', value: 'postgres://old', source: 'env-file' },
        storage,
      );
      const result = await environmentEntityHandler.register(
        { name: 'DATABASE_URL', environment: 'production', kind: 'config', value: 'postgres://new', source: 'env-file' },
        storage,
      );
      expect(result.variant).toBe('updated');
    });

    it('masks secret values', async () => {
      await environmentEntityHandler.register(
        { name: 'API_KEY', environment: 'production', kind: 'secret', value: 'sk-123456', source: 'vault' },
        storage,
      );
      const entry = (await storage.find('environment-entries'))[0];
      expect(entry.value).toBe('***');
      expect(entry.sensitive).toBe('true');
    });

    it('does not mask non-secret values', async () => {
      await environmentEntityHandler.register(
        { name: 'LOG_LEVEL', environment: 'production', kind: 'config', value: 'info', source: 'env-file' },
        storage,
      );
      const entry = (await storage.find('environment-entries'))[0];
      expect(entry.value).toBe('info');
      expect(entry.sensitive).toBe('false');
    });
  });

  describe('get', () => {
    it('retrieves by name and environment', async () => {
      const reg = await environmentEntityHandler.register(
        { name: 'LOG_LEVEL', environment: 'staging', kind: 'config', value: 'debug', source: 'env-file' },
        storage,
      );
      const result = await environmentEntityHandler.get(
        { name: 'LOG_LEVEL', environment: 'staging' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entry).toBe(reg.entry);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await environmentEntityHandler.get(
        { name: 'NOPE', environment: 'production' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('findByEnvironment', () => {
    it('returns all entries for an environment', async () => {
      await environmentEntityHandler.register(
        { name: 'DB_URL', environment: 'production', kind: 'config', value: 'pg://...', source: 'env-file' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'API_KEY', environment: 'production', kind: 'secret', value: 'sk-123', source: 'vault' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'DB_URL', environment: 'staging', kind: 'config', value: 'pg://staging', source: 'env-file' },
        storage,
      );
      const result = await environmentEntityHandler.findByEnvironment(
        { environment: 'production' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entries = JSON.parse(result.entries as string);
      expect(entries).toHaveLength(2);
      // Secrets should be masked
      const secret = entries.find((e: { name: string }) => e.name === 'API_KEY');
      expect(secret.value).toBe('***');
      expect(secret.sensitive).toBe(true);
    });
  });

  describe('findByConcept', () => {
    it('returns entries bound to a concept', async () => {
      // boundConcept is set to empty by default, so this tests the query path
      const result = await environmentEntityHandler.findByConcept(
        { concept: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entries = JSON.parse(result.entries as string);
      expect(entries).toHaveLength(0);
    });
  });

  describe('findByRuntime', () => {
    it('returns entries bound to a runtime', async () => {
      const result = await environmentEntityHandler.findByRuntime(
        { runtime: 'api' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const entries = JSON.parse(result.entries as string);
      expect(entries).toHaveLength(0);
    });
  });

  describe('diffEnvironments', () => {
    it('detects differences between environments', async () => {
      await environmentEntityHandler.register(
        { name: 'DB_POOL', environment: 'staging', kind: 'config', value: '5', source: 'env-file' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'DB_POOL', environment: 'production', kind: 'config', value: '20', source: 'env-file' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'DEBUG', environment: 'staging', kind: 'config', value: 'true', source: 'env-file' },
        storage,
      );
      const result = await environmentEntityHandler.diffEnvironments(
        { envA: 'staging', envB: 'production' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      expect(diffs).toHaveLength(2);
      // DB_POOL differs in value
      const poolDiff = diffs.find((d: { name: string }) => d.name === 'DB_POOL');
      expect(poolDiff.aValue).toBe('5');
      expect(poolDiff.bValue).toBe('20');
      // DEBUG only in staging
      const debugDiff = diffs.find((d: { name: string }) => d.name === 'DEBUG');
      expect(debugDiff.onlyInA).toBe(true);
    });

    it('returns same when environments are identical', async () => {
      await environmentEntityHandler.register(
        { name: 'LOG_LEVEL', environment: 'staging', kind: 'config', value: 'info', source: 'env-file' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'LOG_LEVEL', environment: 'production', kind: 'config', value: 'info', source: 'env-file' },
        storage,
      );
      const result = await environmentEntityHandler.diffEnvironments(
        { envA: 'staging', envB: 'production' },
        storage,
      );
      expect(result.variant).toBe('same');
    });

    it('detects entries only in one environment', async () => {
      await environmentEntityHandler.register(
        { name: 'ONLY_PROD', environment: 'production', kind: 'config', value: 'yes', source: 'env-file' },
        storage,
      );
      const result = await environmentEntityHandler.diffEnvironments(
        { envA: 'staging', envB: 'production' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].onlyInB).toBe(true);
    });
  });

  describe('secretsAudit', () => {
    it('returns only secret entries for an environment', async () => {
      await environmentEntityHandler.register(
        { name: 'DB_URL', environment: 'production', kind: 'config', value: 'pg://...', source: 'env-file' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'API_KEY', environment: 'production', kind: 'secret', value: 'sk-123', source: 'vault' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'DB_PASSWORD', environment: 'production', kind: 'secret', value: 'pw', source: 'ssm' },
        storage,
      );
      const result = await environmentEntityHandler.secretsAudit(
        { environment: 'production' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const secrets = JSON.parse(result.secrets as string);
      expect(secrets).toHaveLength(2);
      expect(secrets[0].source).toBeDefined();
    });
  });

  describe('featureFlags', () => {
    it('returns only feature flag entries', async () => {
      await environmentEntityHandler.register(
        { name: 'DB_URL', environment: 'production', kind: 'config', value: 'pg://...', source: 'env-file' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'ENABLE_DARK_MODE', environment: 'production', kind: 'feature-flag', value: 'true', source: 'config-map' },
        storage,
      );
      await environmentEntityHandler.register(
        { name: 'ENABLE_BETA', environment: 'production', kind: 'feature-flag', value: 'false', source: 'config-map' },
        storage,
      );
      const result = await environmentEntityHandler.featureFlags(
        { environment: 'production' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const flags = JSON.parse(result.flags as string);
      expect(flags).toHaveLength(2);
      expect(flags[0].name).toBeDefined();
      expect(flags[0].value).toBeDefined();
    });
  });
});
