// Telemetry — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { telemetryHandler } from './handler.js';
import type { TelemetryStorage } from './types.js';

const createTestStorage = (): TelemetryStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): TelemetryStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Telemetry handler', () => {
  describe('configure', () => {
    it('should store a telemetry config and return ok', async () => {
      const storage = createTestStorage();

      const result = await telemetryHandler.configure(
        { concept: 'auth', endpoint: 'https://metrics.example.com', samplingRate: 0.5 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.config).toBe('config_auth');
      }
    });

    it('should return left for an empty endpoint', async () => {
      const storage = createTestStorage();

      const result = await telemetryHandler.configure(
        { concept: 'auth', endpoint: '   ', samplingRate: 0.5 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('INVALID_ENDPOINT');
      }
    });

    it('should clamp sampling rate to [0, 1]', async () => {
      const storage = createTestStorage();

      const result = await telemetryHandler.configure(
        { concept: 'auth', endpoint: 'https://metrics.example.com', samplingRate: 2.0 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      // Verify the stored value is clamped
      const stored = await storage.get('telemetry_config', 'config_auth');
      expect(stored).not.toBeNull();
      expect((stored as any).samplingRate).toBe(1);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await telemetryHandler.configure(
        { concept: 'auth', endpoint: 'https://metrics.example.com', samplingRate: 0.5 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deployMarker', () => {
    it('should create a marker when no config exists', async () => {
      const storage = createTestStorage();

      const result = await telemetryHandler.deployMarker(
        { kit: 'auth', version: '1.0.0', environment: 'production', status: 'deployed' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should create a marker when config has a valid endpoint', async () => {
      const storage = createTestStorage();
      await storage.put('telemetry_config', 'config_auth', {
        concept: 'auth',
        endpoint: 'https://metrics.example.com',
        samplingRate: 0.5,
      });

      const result = await telemetryHandler.deployMarker(
        { kit: 'auth', version: '1.0.0', environment: 'staging', status: 'deployed' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return backendUnavailable when config has empty endpoint', async () => {
      const storage = createTestStorage();
      await storage.put('telemetry_config', 'config_auth', {
        concept: 'auth',
        endpoint: '',
        samplingRate: 0.5,
      });

      const result = await telemetryHandler.deployMarker(
        { kit: 'auth', version: '1.0.0', environment: 'staging', status: 'deployed' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('backendUnavailable');
      }
    });
  });

  describe('analyze', () => {
    it('should return backendUnavailable when no config exists', async () => {
      const storage = createTestStorage();

      const result = await telemetryHandler.analyze(
        { concept: 'auth', window: 3600, criteria: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('backendUnavailable');
      }
    });

    it('should return insufficientData when fewer than 10 events', async () => {
      const storage = createTestStorage();
      await storage.put('telemetry_config', 'config_auth', {
        concept: 'auth',
        endpoint: 'https://metrics.example.com',
        samplingRate: 1.0,
      });

      const result = await telemetryHandler.analyze(
        { concept: 'auth', window: 3600, criteria: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('insufficientData');
      }
    });

    it('should return ok with health metrics when enough events exist', async () => {
      const storage = createTestStorage();
      await storage.put('telemetry_config', 'config_auth', {
        concept: 'auth',
        endpoint: 'https://metrics.example.com',
        samplingRate: 1.0,
      });

      const now = Date.now();
      for (let i = 0; i < 15; i++) {
        await storage.put('telemetry_event', `evt-${i}`, {
          concept: 'auth',
          timestamp: now - 1000,
          error: i < 1,
          latencyMs: 100 + i * 10,
        });
      }

      const result = await telemetryHandler.analyze(
        { concept: 'auth', window: 3600, criteria: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.sampleSize).toBe(15);
        }
      }
    });
  });
});
