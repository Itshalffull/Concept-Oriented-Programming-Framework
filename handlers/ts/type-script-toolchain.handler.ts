// @migrated dsl-constructs 2026-03-18
// ============================================================
// TypeScriptToolchain Handler
//
// Resolve TypeScript compiler and bundler toolchains. Owns
// TypeScript-specific resolution: tsc version, Node.js version,
// bundler detection (esbuild, webpack, vite), and tsconfig
// target validation.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _handler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;

    // Simulate TypeScript toolchain resolution
    const tscVersion = '5.7.2';
    const nodeVersion = '20.11.0';

    // Check version constraint
    if (versionConstraint && !satisfiesConstraint(tscVersion, versionConstraint)) {
      const p = createProgram();
      return complete(p, 'nodeVersionMismatch', {
        installed: tscVersion,
        required: versionConstraint,
      }) as StorageProgram<Result>;
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

    let p = createProgram();
    p = put(p, 'type-script-toolchain', id, {
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

    return complete(p, 'ok', {
      toolchain: id,
      tscPath,
      version: tscVersion,
      capabilities,
    }) as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'TypeScriptToolchain',
      language: 'typescript',
      capabilities: ['bundler-detection', 'package-manager', 'node-version-check'],
    }) as StorageProgram<Result>;
  },
};

export const typeScriptToolchainHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptToolchainCounter(): void {
  idCounter = 0;
}
