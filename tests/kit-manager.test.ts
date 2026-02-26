// ============================================================
// KitManager Handler Tests
//
// Manage concept kits: scaffold new kits, validate kit
// manifests, run kit tests, list active kits, and check
// app overrides.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  kitManagerHandler,
  resetKitManagerCounter,
} from '../implementations/typescript/kit-manager.impl.js';

describe('KitManager', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetKitManagerCounter();
  });

  describe('init', () => {
    it('initializes a new kit and returns ok', async () => {
      const result = await kitManagerHandler.init!(
        { name: 'my-kit' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kit).toBe('kit-manager-1');
      expect(result.path).toBe('./kits/my-kit/');
    });

    it('stores kit metadata in storage', async () => {
      await kitManagerHandler.init!(
        { name: 'auth-kit' },
        storage,
      );
      const stored = await storage.get('kit-manager', 'kit-manager-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('auth-kit');
      expect(stored!.path).toBe('./kits/auth-kit/');
      expect(stored!.status).toBe('initialized');
    });

    it('returns alreadyExists when kit name is taken', async () => {
      await kitManagerHandler.init!(
        { name: 'duplicate-kit' },
        storage,
      );
      const result = await kitManagerHandler.init!(
        { name: 'duplicate-kit' },
        storage,
      );
      expect(result.variant).toBe('alreadyExists');
      expect(result.name).toBe('duplicate-kit');
    });

    it('assigns unique IDs to different kits', async () => {
      const first = await kitManagerHandler.init!(
        { name: 'kit-a' },
        storage,
      );
      const second = await kitManagerHandler.init!(
        { name: 'kit-b' },
        storage,
      );
      expect(first.kit).toBe('kit-manager-1');
      expect(second.kit).toBe('kit-manager-2');
    });
  });

  describe('validate', () => {
    it('validates an existing kit and returns ok', async () => {
      await kitManagerHandler.init!(
        { name: 'my-kit' },
        storage,
      );
      const result = await kitManagerHandler.validate!(
        { path: './kits/my-kit/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kit).toBe('kit-manager-1');
      expect(result.concepts).toBe(0);
      expect(result.syncs).toBe(0);
    });

    it('creates a temporary entry when kit path is not found', async () => {
      const result = await kitManagerHandler.validate!(
        { path: './kits/unknown-kit/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kit).toBe('kit-manager-1');

      const stored = await storage.get('kit-manager', 'kit-manager-1');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('validated');
    });

    it('updates the kit status to validated', async () => {
      await kitManagerHandler.init!(
        { name: 'my-kit' },
        storage,
      );
      await kitManagerHandler.validate!(
        { path: './kits/my-kit/' },
        storage,
      );
      const stored = await storage.get('kit-manager', 'kit-manager-1');
      expect(stored!.status).toBe('validated');
    });
  });

  describe('test', () => {
    it('tests an existing kit and returns ok', async () => {
      await kitManagerHandler.init!(
        { name: 'my-kit' },
        storage,
      );
      const result = await kitManagerHandler.test!(
        { path: './kits/my-kit/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kit).toBe('kit-manager-1');
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('creates a temporary entry when kit path is not found', async () => {
      const result = await kitManagerHandler.test!(
        { path: './kits/new-kit/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kit).toBe('kit-manager-1');

      const stored = await storage.get('kit-manager', 'kit-manager-1');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('tested');
    });
  });

  describe('list', () => {
    it('returns empty list when no kits exist', async () => {
      const result = await kitManagerHandler.list!(
        {},
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.kits).toEqual([]);
    });

    it('lists all initialized kits', async () => {
      await kitManagerHandler.init!({ name: 'kit-a' }, storage);
      await kitManagerHandler.init!({ name: 'kit-b' }, storage);
      await kitManagerHandler.init!({ name: 'kit-c' }, storage);

      const result = await kitManagerHandler.list!({}, storage);
      expect(result.variant).toBe('ok');
      expect((result.kits as string[]).length).toBe(3);
      expect(result.kits).toContain('kit-a');
      expect(result.kits).toContain('kit-b');
      expect(result.kits).toContain('kit-c');
    });
  });

  describe('checkOverrides', () => {
    it('returns ok for an existing kit path', async () => {
      await kitManagerHandler.init!(
        { name: 'my-kit' },
        storage,
      );
      const result = await kitManagerHandler.checkOverrides!(
        { path: './kits/my-kit/' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.valid).toBe(0);
      expect(result.warnings).toEqual([]);
    });

    it('returns invalidOverride for non-existent kit path', async () => {
      const result = await kitManagerHandler.checkOverrides!(
        { path: './kits/nonexistent/' },
        storage,
      );
      expect(result.variant).toBe('invalidOverride');
      expect(result.override).toBe('./kits/nonexistent/');
      expect(result.reason).toContain('Kit not found');
    });
  });
});
