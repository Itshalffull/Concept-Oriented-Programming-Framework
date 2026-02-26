// ============================================================
// TypeScriptToolchain Handler Tests
//
// Resolve TypeScript compiler and bundler toolchains. Covers
// tsc version detection, Node.js version validation, bundler
// detection, and capability resolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  typeScriptToolchainHandler,
  resetTypeScriptToolchainCounter,
} from '../implementations/typescript/type-script-toolchain.impl.js';

describe('TypeScriptToolchain', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTypeScriptToolchainCounter();
  });

  describe('resolve', () => {
    it('resolves a toolchain for node platform', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'node-20' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.toolchain).toBe('type-script-toolchain-1');
      expect(result.tscPath).toBeDefined();
      expect(result.version).toBe('5.7.2');
      expect(result.capabilities).toBeDefined();
    });

    it('stores toolchain metadata in storage', async () => {
      await typeScriptToolchainHandler.resolve!(
        { platform: 'node-20' },
        storage,
      );
      const stored = await storage.get('type-script-toolchain', 'type-script-toolchain-1');
      expect(stored).not.toBeNull();
      expect(stored!.tscVersion).toBe('5.7.2');
      expect(stored!.nodeVersion).toBe('20.11.0');
      expect(stored!.packageManager).toBe('npm');
      expect(stored!.platform).toBe('node-20');
    });

    it('includes cjs capability for node platforms', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'node-20' },
        storage,
      );
      const capabilities = result.capabilities as string[];
      expect(capabilities).toContain('esm');
      expect(capabilities).toContain('cjs');
      expect(capabilities).toContain('declaration-maps');
      expect(capabilities).toContain('bundler-resolution');
      expect(capabilities).toContain('composite-projects');
    });

    it('does not include cjs capability for non-node platforms', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'browser' },
        storage,
      );
      const capabilities = result.capabilities as string[];
      expect(capabilities).toContain('esm');
      expect(capabilities).not.toContain('cjs');
    });

    it('resolves with unix path for non-windows platforms', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'linux-x64' },
        storage,
      );
      expect(result.tscPath).toBe('/usr/local/bin/tsc');
    });

    it('resolves with windows path for windows platforms', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'win-x64' },
        storage,
      );
      expect(result.tscPath).toBe('node_modules\\.bin\\tsc');
    });

    it('satisfies version constraint when compatible', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'node-20', versionConstraint: '>=5.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns nodeVersionMismatch when constraint is not met', async () => {
      const result = await typeScriptToolchainHandler.resolve!(
        { platform: 'node-20', versionConstraint: '>=6.0' },
        storage,
      );
      expect(result.variant).toBe('nodeVersionMismatch');
      expect(result.installed).toBe('5.7.2');
      expect(result.required).toBe('>=6.0');
    });

    it('assigns unique IDs to different toolchain resolutions', async () => {
      const first = await typeScriptToolchainHandler.resolve!(
        { platform: 'node-20' },
        storage,
      );
      const second = await typeScriptToolchainHandler.resolve!(
        { platform: 'browser' },
        storage,
      );
      expect(first.toolchain).toBe('type-script-toolchain-1');
      expect(second.toolchain).toBe('type-script-toolchain-2');
    });
  });

  describe('register', () => {
    it('returns toolchain registration info', async () => {
      const result = await typeScriptToolchainHandler.register!(
        {},
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('TypeScriptToolchain');
      expect(result.language).toBe('typescript');
      expect(result.capabilities).toContain('bundler-detection');
      expect(result.capabilities).toContain('package-manager');
      expect(result.capabilities).toContain('node-version-check');
    });
  });
});
