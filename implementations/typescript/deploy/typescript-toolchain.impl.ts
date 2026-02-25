// TypeScriptToolchain Concept Implementation
// TypeScript provider for the Toolchain coordination concept. Manages
// tsc resolution, Node.js version checking, and bundler detection.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'ts-tool';

export const typescriptToolchainHandler: ConceptHandler = {
  async resolve(input, storage) {
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;

    // Check if a toolchain for this platform already exists in storage
    const existing = await storage.find(RELATION, { platform });
    if (existing.length > 0) {
      const rec = existing[0];
      return {
        variant: 'ok',
        toolchain: rec.toolchain as string,
        tscPath: rec.tscPath as string,
        version: rec.version as string,
        capabilities: JSON.parse(rec.capabilities as string),
      };
    }

    if (!platform) {
      return {
        variant: 'nodeVersionMismatch',
        installed: 'unknown',
        required: 'Platform must be specified to determine Node.js version requirements',
      };
    }

    if (versionConstraint && versionConstraint.startsWith('>=18') && platform === 'legacy') {
      return {
        variant: 'nodeVersionMismatch',
        installed: '16.20.0',
        required: versionConstraint,
      };
    }

    // Simulate tsc not installed for unknown platforms
    if (platform !== 'node' && platform !== 'browser' && platform !== 'deno') {
      return {
        variant: 'notInstalled',
        installHint: 'npm install -g typescript',
      };
    }

    const toolchainId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tscPath = '/usr/local/bin/tsc';
    const version = '5.7.2';
    const capabilities = ['esm', 'cjs', 'declaration-maps', 'composite-projects'];

    await storage.put(RELATION, toolchainId, {
      toolchain: toolchainId,
      platform,
      versionConstraint: versionConstraint || '',
      tscPath,
      version,
      capabilities: JSON.stringify(capabilities),
      resolvedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      toolchain: toolchainId,
      tscPath,
      version,
      capabilities,
    };
  },

  async register(_input, _storage) {
    return {
      variant: 'ok',
      name: 'TypeScriptToolchain',
      language: 'typescript',
      capabilities: ['bundler-detection', 'package-manager', 'node-version-check'],
    };
  },
};
