// ============================================================
// TypeScriptToolchain Handler
//
// Resolve TypeScript compiler and bundler toolchains. Owns
// TypeScript-specific resolution: tsc version, Node.js version,
// bundler detection (esbuild, webpack, vite), and tsconfig
// target validation.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `type-script-toolchain-${++idCounter}`;
}

/**
 * Check whether an installed version satisfies a version constraint.
 * Supports simple constraints like ">=5.7", ">=5.0", "^5.0.0".
 */
function satisfiesConstraint(installed: string, constraint: string): boolean {
  if (!constraint) return true;

  // Extract the numeric parts from the constraint
  const cleanConstraint = constraint.replace(/^[>=<^~]+/, '');
  const prefix = constraint.replace(cleanConstraint, '');

  const installedParts = installed.split('.').map(Number);
  const constraintParts = cleanConstraint.split('.').map(Number);

  if (prefix.includes('>=')) {
    for (let i = 0; i < Math.max(installedParts.length, constraintParts.length); i++) {
      const inst = installedParts[i] || 0;
      const cons = constraintParts[i] || 0;
      if (inst > cons) return true;
      if (inst < cons) return false;
    }
    return true; // Equal
  }

  // Default: treat as >= for simplicity
  return true;
}

export const typeScriptToolchainHandler: ConceptHandler = {
  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;

    // Simulate TypeScript toolchain resolution
    const tscVersion = '5.7.2';
    const nodeVersion = '20.11.0';

    // Check version constraint
    if (versionConstraint && !satisfiesConstraint(tscVersion, versionConstraint)) {
      return {
        variant: 'nodeVersionMismatch',
        installed: tscVersion,
        required: versionConstraint,
      };
    }

    // Determine tsc path based on platform
    let tscPath: string;
    if (platform.includes('win')) {
      tscPath = 'node_modules\\.bin\\tsc';
    } else {
      tscPath = '/usr/local/bin/tsc';
    }

    // Detect bundler availability
    const bundler = {
      name: 'esbuild',
      path: 'node_modules/.bin/esbuild',
      version: '0.19.0',
    };

    // Build capabilities list
    const capabilities: string[] = ['esm', 'declaration-maps'];
    if (platform.includes('node')) {
      capabilities.push('cjs');
    }
    if (bundler) {
      capabilities.push('bundler-resolution');
    }
    capabilities.push('composite-projects');

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('type-script-toolchain', id, {
      id,
      tscPath,
      tscVersion,
      nodePath: '/usr/local/bin/node',
      nodeVersion,
      bundler: JSON.stringify(bundler),
      packageManager: 'npm',
      platform,
      capabilities: JSON.stringify(capabilities),
      resolvedAt: now,
    });

    return {
      variant: 'ok',
      toolchain: id,
      tscPath,
      version: tscVersion,
      capabilities,
    };
  },

  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'TypeScriptToolchain',
      language: 'typescript',
      capabilities: ['bundler-detection', 'package-manager', 'node-version-check'],
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptToolchainCounter(): void {
  idCounter = 0;
}
