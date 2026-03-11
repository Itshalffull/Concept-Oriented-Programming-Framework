// ============================================================
// SuiteManager Handler Tests
//
// Manage suites: scaffold new suites, validate suite
// manifests, run suite tests, list active suites, and check
// app overrides.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  suiteManagerHandler,
  resetSuiteManagerCounter,
} from '../handlers/ts/suite-manager.handler.js';

describe('SuiteManager', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSuiteManagerCounter();
  });

  describe('init', () => {
    it('initializes a new suite and returns ok', async () => {
      const result = await suiteManagerHandler.init!(
        { name: 'my-suite' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suite).toBe('suite-manager-1');
      expect(result.path).toBe('./repertoire/my-suite/');
    });

    it('stores suite metadata in storage', async () => {
      await suiteManagerHandler.init!(
        { name: 'auth-suite' },
        storage,
      );
      const stored = await storage.get('suite-manager', 'suite-manager-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('auth-suite');
      expect(stored!.path).toBe('./repertoire/auth-suite/');
      expect(stored!.status).toBe('initialized');
    });

    it('returns alreadyExists when suite name is taken', async () => {
      await suiteManagerHandler.init!(
        { name: 'duplicate-suite' },
        storage,
      );
      const result = await suiteManagerHandler.init!(
        { name: 'duplicate-suite' },
        storage,
      );
      expect(result.variant).toBe('alreadyExists');
      expect(result.name).toBe('duplicate-suite');
    });

    it('assigns unique IDs to different suites', async () => {
      const first = await suiteManagerHandler.init!(
        { name: 'suite-a' },
        storage,
      );
      const second = await suiteManagerHandler.init!(
        { name: 'suite-b' },
        storage,
      );
      expect(first.suite).toBe('suite-manager-1');
      expect(second.suite).toBe('suite-manager-2');
    });
  });

  describe('validate', () => {
    it('validates an existing suite and returns ok', async () => {
      await suiteManagerHandler.init!(
        { name: 'my-suite' },
        storage,
      );
      const result = await suiteManagerHandler.validate!(
        { path: './repertoire/my-suite/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suite).toBe('suite-manager-1');
      expect(result.concepts).toBe(0);
      expect(result.syncs).toBe(0);
    });

    it('creates a temporary entry when suite path is not found', async () => {
      const result = await suiteManagerHandler.validate!(
        { path: './repertoire/unknown-suite/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suite).toBe('suite-manager-1');

      const stored = await storage.get('suite-manager', 'suite-manager-1');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('validated');
    });

    it('updates the suite status to validated', async () => {
      await suiteManagerHandler.init!(
        { name: 'my-suite' },
        storage,
      );
      await suiteManagerHandler.validate!(
        { path: './repertoire/my-suite/' },
        storage,
      );
      const stored = await storage.get('suite-manager', 'suite-manager-1');
      expect(stored!.status).toBe('validated');
    });
  });

  describe('test', () => {
    it('tests an existing suite and returns ok', async () => {
      await suiteManagerHandler.init!(
        { name: 'my-suite' },
        storage,
      );
      const result = await suiteManagerHandler.test!(
        { path: './repertoire/my-suite/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suite).toBe('suite-manager-1');
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('creates a temporary entry when suite path is not found', async () => {
      const result = await suiteManagerHandler.test!(
        { path: './repertoire/new-suite/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suite).toBe('suite-manager-1');

      const stored = await storage.get('suite-manager', 'suite-manager-1');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('tested');
    });
  });

  describe('list', () => {
    it('returns empty list when no suites exist', async () => {
      const result = await suiteManagerHandler.list!(
        {},
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suites).toEqual([]);
    });

    it('lists all initialized suites', async () => {
      await suiteManagerHandler.init!({ name: 'suite-a' }, storage);
      await suiteManagerHandler.init!({ name: 'suite-b' }, storage);
      await suiteManagerHandler.init!({ name: 'suite-c' }, storage);

      const result = await suiteManagerHandler.list!({}, storage);
      expect(result.variant).toBe('ok');
      expect((result.suites as string[]).length).toBe(3);
      expect(result.suites).toContain('suite-a');
      expect(result.suites).toContain('suite-b');
      expect(result.suites).toContain('suite-c');
    });
  });

  describe('checkOverrides', () => {
    it('returns ok for an existing suite path', async () => {
      await suiteManagerHandler.init!(
        { name: 'my-suite' },
        storage,
      );
      const result = await suiteManagerHandler.checkOverrides!(
        { path: './repertoire/my-suite/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.valid).toBe(0);
      expect(result.warnings).toEqual([]);
    });

    it('returns invalidOverride for non-existent suite path', async () => {
      const result = await suiteManagerHandler.checkOverrides!(
        { path: './repertoire/nonexistent/' },
        storage,
      );
      expect(result.variant).toBe('invalidOverride');
      expect(result.override).toBe('./repertoire/nonexistent/');
      expect(result.reason).toContain('Suite not found');
    });
  });
});
