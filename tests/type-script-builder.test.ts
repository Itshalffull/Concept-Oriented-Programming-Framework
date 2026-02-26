// ============================================================
// TypeScriptBuilder Handler Tests
//
// Compile, test, and package TypeScript concept implementations.
// Covers build configuration, test runner integration, package
// format generation, and builder registration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  typeScriptBuilderHandler,
  resetTypeScriptBuilderCounter,
} from '../handlers/ts/type-script-builder.handler.js';

describe('TypeScriptBuilder', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTypeScriptBuilderCounter();
  });

  describe('build', () => {
    it('builds a TypeScript project for node-20 platform', async () => {
      const result = await typeScriptBuilderHandler.build!(
        {
          source: './src/my-concept',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'node-20',
          config: { mode: 'release', features: ['strict'] },
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.build).toBe('type-script-builder-1');
      expect(result.artifactPath).toContain('typescript');
      expect(result.artifactHash).toBeDefined();
    });

    it('stores build metadata in storage', async () => {
      await typeScriptBuilderHandler.build!(
        {
          source: './src/my-concept',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'node-20',
          config: { mode: 'debug' },
        },
        storage,
      );
      const stored = await storage.get('type-script-builder', 'type-script-builder-1');
      expect(stored).not.toBeNull();
      expect(stored!.platform).toBe('node-20');
      expect(stored!.moduleFormat).toBe('esm');
      expect(stored!.tsconfigTarget).toBe('ES2022');
      expect(stored!.mode).toBe('debug');
    });

    it('uses esm module format for browser platform', async () => {
      await typeScriptBuilderHandler.build!(
        {
          source: './src/widget',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'browser',
          config: {},
        },
        storage,
      );
      const stored = await storage.get('type-script-builder', 'type-script-builder-1');
      expect(stored!.moduleFormat).toBe('esm');
      expect(stored!.tsconfigTarget).toBe('ES2020');
      expect(stored!.bundler).toBe('esbuild');
    });

    it('uses commonjs module format for cjs platform', async () => {
      await typeScriptBuilderHandler.build!(
        {
          source: './src/legacy',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'cjs',
          config: {},
        },
        storage,
      );
      const stored = await storage.get('type-script-builder', 'type-script-builder-1');
      expect(stored!.moduleFormat).toBe('commonjs');
      expect(stored!.tsconfigTarget).toBe('ES2020');
    });

    it('defaults to debug mode when config mode is not specified', async () => {
      await typeScriptBuilderHandler.build!(
        {
          source: './src/concept',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'node-20',
          config: {},
        },
        storage,
      );
      const stored = await storage.get('type-script-builder', 'type-script-builder-1');
      expect(stored!.mode).toBe('debug');
    });

    it('assigns unique IDs to different builds', async () => {
      const first = await typeScriptBuilderHandler.build!(
        { source: './src/a', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      const second = await typeScriptBuilderHandler.build!(
        { source: './src/b', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      expect(first.build).toBe('type-script-builder-1');
      expect(second.build).toBe('type-script-builder-2');
    });
  });

  describe('test', () => {
    it('runs tests on an existing build', async () => {
      await typeScriptBuilderHandler.build!(
        { source: './src/concept', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      const result = await typeScriptBuilderHandler.test!(
        { build: 'type-script-builder-1', toolchainPath: 'tsc' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.testType).toBe('unit');
    });

    it('returns testFailure when build does not exist', async () => {
      const result = await typeScriptBuilderHandler.test!(
        { build: 'nonexistent', toolchainPath: 'tsc' },
        storage,
      );
      expect(result.variant).toBe('testFailure');
      expect(result.failed).toBe(1);
      expect((result.failures as Array<{ message: string }>)[0].message).toContain('not found');
    });

    it('uses custom invocation when provided', async () => {
      await typeScriptBuilderHandler.build!(
        { source: './src/concept', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      const result = await typeScriptBuilderHandler.test!(
        {
          build: 'type-script-builder-1',
          toolchainPath: 'tsc',
          invocation: { command: 'npx jest', outputFormat: 'jest-json' },
          testType: 'integration',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.testType).toBe('integration');

      const stored = await storage.get('type-script-builder', 'type-script-builder-1');
      expect(stored!.lastTestCommand).toBe('npx jest');
      expect(stored!.lastTestOutputFormat).toBe('jest-json');
      expect(stored!.lastTestType).toBe('integration');
    });
  });

  describe('package', () => {
    it('packages a build as npm tarball', async () => {
      await typeScriptBuilderHandler.build!(
        { source: './src/concept', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      const result = await typeScriptBuilderHandler.package!(
        { build: 'type-script-builder-1', format: 'npm' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.artifactPath).toContain('package.tgz');
      expect(result.artifactHash).toBeDefined();
    });

    it('packages a build as bundle', async () => {
      await typeScriptBuilderHandler.build!(
        { source: './src/concept', toolchainPath: 'tsc', platform: 'browser', config: {} },
        storage,
      );
      const result = await typeScriptBuilderHandler.package!(
        { build: 'type-script-builder-1', format: 'bundle' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.artifactPath).toContain('bundle.js');
    });

    it('packages a build as docker', async () => {
      await typeScriptBuilderHandler.build!(
        { source: './src/concept', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      const result = await typeScriptBuilderHandler.package!(
        { build: 'type-script-builder-1', format: 'docker' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.artifactPath).toContain('Dockerfile');
    });

    it('returns formatUnsupported for unknown format', async () => {
      await typeScriptBuilderHandler.build!(
        { source: './src/concept', toolchainPath: 'tsc', platform: 'node-20', config: {} },
        storage,
      );
      const result = await typeScriptBuilderHandler.package!(
        { build: 'type-script-builder-1', format: 'rpm' },
        storage,
      );
      expect(result.variant).toBe('formatUnsupported');
      expect(result.format).toBe('rpm');
    });

    it('returns formatUnsupported when build does not exist', async () => {
      const result = await typeScriptBuilderHandler.package!(
        { build: 'nonexistent', format: 'npm' },
        storage,
      );
      expect(result.variant).toBe('formatUnsupported');
    });
  });

  describe('register', () => {
    it('returns builder registration info', async () => {
      const result = await typeScriptBuilderHandler.register!(
        {},
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('TypeScriptBuilder');
      expect(result.language).toBe('typescript');
      expect(result.capabilities).toContain('npm');
      expect(result.capabilities).toContain('bundle');
      expect(result.capabilities).toContain('docker');
    });
  });
});
