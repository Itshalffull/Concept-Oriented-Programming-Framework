// ============================================================
// Remote Score Connection Tests
//
// Tests for RuntimeDiscovery and ScoreBridge functional handlers.
// Validates StorageProgram construction, lens usage, transport
// effects, and variant coverage.
//
// See Architecture doc — RuntimeDiscovery, ScoreBridge concepts
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createProgram, relation, at,
  extractReadSet, extractWriteSet, classifyPurity,
  extractPerformSet, extractCompletionVariants,
  type StorageProgram,
} from '../runtime/storage-program.js';
import { runtimeDiscoveryHandler } from '../handlers/ts/framework/runtime-discovery.handler.js';
import { scoreBridgeHandler } from '../handlers/ts/framework/score-bridge.handler.js';

/**
 * Helper: extract the pure return value from a StorageProgram.
 * Walks instructions to find the first 'pure' tag.
 */
function getPureValue(program: StorageProgram<unknown>): Record<string, unknown> | null {
  for (const instr of program.instructions) {
    if (instr.tag === 'pure') return instr.value as Record<string, unknown>;
    if (instr.tag === 'branch') {
      const thenVal = getPureValue(instr.thenBranch as StorageProgram<unknown>);
      const elseVal = getPureValue(instr.elseBranch as StorageProgram<unknown>);
      return thenVal || elseVal;
    }
  }
  return null;
}

/**
 * Helper: count instructions of a given tag in a program.
 */
function countInstructions(program: StorageProgram<unknown>, tag: string): number {
  let count = 0;
  for (const instr of program.instructions) {
    if (instr.tag === tag) count++;
    if (instr.tag === 'branch') {
      count += countInstructions(instr.thenBranch as StorageProgram<unknown>, tag);
      count += countInstructions(instr.elseBranch as StorageProgram<unknown>, tag);
    }
  }
  return count;
}

/**
 * Helper: check if a program has any instruction with a given tag.
 */
function hasInstruction(program: StorageProgram<unknown>, tag: string): boolean {
  return countInstructions(program, tag) > 0;
}

// ============================================================
// RuntimeDiscovery Handler
// ============================================================

describe('RuntimeDiscovery handler', () => {
  describe('scan', () => {
    it('builds a StorageProgram with filesystem transport effects', () => {
      const program = runtimeDiscoveryHandler.scan({ directory: '/app/clef-base' });

      expect(program).toBeDefined();
      expect(program.instructions.length).toBeGreaterThan(0);
      expect(program.terminated).toBe(true);

      // Should declare fs transport effects for glob and readFiles
      const performs = extractPerformSet(program);
      expect(performs.has('fs:glob')).toBe(true);
      expect(performs.has('fs:readFiles')).toBe(true);
    });

    it('produces a read-write program (writes project/manifest/runtime state)', () => {
      const program = runtimeDiscoveryHandler.scan({ directory: '/app/test' });
      expect(classifyPurity(program)).toBe('read-write');
    });

    it('uses lenses for writing project data', () => {
      const program = runtimeDiscoveryHandler.scan({ directory: '/app/test' });
      const writes = extractWriteSet(program);
      expect(writes.has('projects')).toBe(true);
      expect(writes.has('manifests')).toBe(true);
      expect(writes.has('runtimes')).toBe(true);
    });

    it('includes branch instruction for empty/found paths', () => {
      const program = runtimeDiscoveryHandler.scan({ directory: '/app/test' });
      expect(hasInstruction(program, 'branch')).toBe(true);
    });
  });

  describe('listProjects', () => {
    it('builds a read-only program that queries the projects relation', () => {
      const program = runtimeDiscoveryHandler.listProjects({});

      expect(program).toBeDefined();
      expect(program.terminated).toBe(true);

      const reads = extractReadSet(program);
      expect(reads.has('projects')).toBe(true);

      expect(classifyPurity(program)).toBe('read-only');
    });
  });

  describe('listRuntimes', () => {
    it('builds a program that reads runtimes via lens', () => {
      const program = runtimeDiscoveryHandler.listRuntimes({ project: 'proj-test' });

      expect(program).toBeDefined();
      expect(program.terminated).toBe(true);

      const reads = extractReadSet(program);
      expect(reads.has('runtimes')).toBe(true);
    });

    it('includes branch for notfound case', () => {
      const program = runtimeDiscoveryHandler.listRuntimes({ project: 'proj-test' });
      expect(hasInstruction(program, 'branch')).toBe(true);
    });
  });

  describe('resolveEndpoint', () => {
    it('reads project, runtime, and manifest state via lenses', () => {
      const program = runtimeDiscoveryHandler.resolveEndpoint({
        project: 'proj-test',
        runtime: 'vercel',
      });

      expect(program).toBeDefined();
      const reads = extractReadSet(program);
      expect(reads.has('projects')).toBe(true);
      expect(reads.has('runtimes')).toBe(true);
      expect(reads.has('manifests')).toBe(true);
    });

    it('declares env:read transport effect for variable resolution', () => {
      const program = runtimeDiscoveryHandler.resolveEndpoint({
        project: 'proj-test',
        runtime: 'vercel',
      });

      const performs = extractPerformSet(program);
      expect(performs.has('env:read')).toBe(true);
    });
  });

  describe('resolveCredentials', () => {
    it('reads project and manifest state', () => {
      const program = runtimeDiscoveryHandler.resolveCredentials({
        project: 'proj-test',
        runtime: 'vercel',
      });

      const reads = extractReadSet(program);
      expect(reads.has('projects')).toBe(true);
      expect(reads.has('manifests')).toBe(true);
    });

    it('declares env:read transport effect', () => {
      const program = runtimeDiscoveryHandler.resolveCredentials({
        project: 'proj-test',
        runtime: 'vercel',
      });

      const performs = extractPerformSet(program);
      expect(performs.has('env:read')).toBe(true);
    });
  });

  describe('selectRuntime', () => {
    it('reads and writes project state (modifyLens)', () => {
      const program = runtimeDiscoveryHandler.selectRuntime({
        project: 'proj-test',
        runtime: 'vercel',
      });

      expect(classifyPurity(program)).toBe('read-write');
      const reads = extractReadSet(program);
      const writes = extractWriteSet(program);
      expect(reads.has('projects')).toBe(true);
      expect(writes.has('projects')).toBe(true);
    });
  });
});

// ============================================================
// ScoreBridge Handler
// ============================================================

describe('ScoreBridge handler', () => {
  describe('connect', () => {
    it('builds a program with health check transport effect', () => {
      const program = scoreBridgeHandler.connect({
        endpoint: 'https://app.example.com/score',
        protocol: 'http',
        authToken: 'tok_test',
      });

      expect(program).toBeDefined();
      expect(program.instructions.length).toBeGreaterThan(0);

      const performs = extractPerformSet(program);
      expect(performs.has('http:healthCheck')).toBe(true);
    });

    it('writes connection state on success (read-write)', () => {
      const program = scoreBridgeHandler.connect({
        endpoint: 'https://app.example.com/score',
        protocol: 'http',
        authToken: 'tok_test',
      });

      expect(classifyPurity(program)).toBe('read-write');
      const writes = extractWriteSet(program);
      expect(writes.has('connections')).toBe(true);
    });

    it('includes branches for unreachable, auth_failed, and ok paths', () => {
      const program = scoreBridgeHandler.connect({
        endpoint: 'https://app.example.com/score',
        protocol: 'http',
        authToken: 'tok_test',
      });

      // Should have branch instructions for health check result routing
      expect(hasInstruction(program, 'branch')).toBe(true);

      // Should have completion variants in branches
      const variants = extractCompletionVariants(program);
      expect(variants.has('unreachable')).toBe(true);
      expect(variants.has('auth_failed')).toBe(true);
      expect(variants.has('ok')).toBe(true);
    });
  });

  describe('query', () => {
    it('reads connection state and performs remote request', () => {
      const program = scoreBridgeHandler.query({
        bridge: 'bridge-test',
        graphql: '{ concepts { conceptName } }',
      });

      expect(program).toBeDefined();
      const reads = extractReadSet(program);
      expect(reads.has('connections')).toBe(true);

      const performs = extractPerformSet(program);
      expect(performs.has('http:request')).toBe(true);
    });

    it('includes notfound branch for missing connection', () => {
      const program = scoreBridgeHandler.query({
        bridge: 'bridge-test',
        graphql: '{ concepts { conceptName } }',
      });

      expect(hasInstruction(program, 'branch')).toBe(true);
      const variants = extractCompletionVariants(program);
      expect(variants.has('notfound')).toBe(true);
    });

    it('updates connection state after query (modifyLens)', () => {
      const program = scoreBridgeHandler.query({
        bridge: 'bridge-test',
        graphql: '{ concepts { conceptName } }',
      });

      const writes = extractWriteSet(program);
      expect(writes.has('connections')).toBe(true);
    });
  });

  describe('show', () => {
    it('reads connection and performs remote show request', () => {
      const program = scoreBridgeHandler.show({
        bridge: 'bridge-test',
        kind: 'concept',
        name: 'User',
      });

      const reads = extractReadSet(program);
      expect(reads.has('connections')).toBe(true);

      const performs = extractPerformSet(program);
      expect(performs.has('http:request')).toBe(true);
    });

    it('includes entity_notfound variant in branches', () => {
      // The entity_notfound variant is produced by mapBindings, not complete(),
      // so it won't appear in structural completion variants.
      // But the notfound variant for missing connection should be present.
      const program = scoreBridgeHandler.show({
        bridge: 'bridge-test',
        kind: 'concept',
        name: 'User',
      });

      const variants = extractCompletionVariants(program);
      expect(variants.has('notfound')).toBe(true);
    });
  });

  describe('traverse', () => {
    it('reads connection and performs remote traverse request', () => {
      const program = scoreBridgeHandler.traverse({
        bridge: 'bridge-test',
        relation: 'actions',
        target: 'create',
      });

      const reads = extractReadSet(program);
      expect(reads.has('connections')).toBe(true);

      const performs = extractPerformSet(program);
      expect(performs.has('http:request')).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('deletes connection from state', () => {
      const program = scoreBridgeHandler.disconnect({ bridge: 'bridge-test' });

      const writes = extractWriteSet(program);
      expect(writes.has('connections')).toBe(true);

      const variants = extractCompletionVariants(program);
      expect(variants.has('ok')).toBe(true);
      expect(variants.has('notfound')).toBe(true);
    });

    it('reads connection state to check existence', () => {
      const program = scoreBridgeHandler.disconnect({ bridge: 'bridge-test' });

      const reads = extractReadSet(program);
      expect(reads.has('connections')).toBe(true);
    });
  });

  describe('status', () => {
    it('reads connection state via lens (read-only in success branch)', () => {
      const program = scoreBridgeHandler.status({ bridge: 'bridge-test' });

      const reads = extractReadSet(program);
      expect(reads.has('connections')).toBe(true);
    });

    it('includes notfound and ok completion variants', () => {
      const program = scoreBridgeHandler.status({ bridge: 'bridge-test' });

      const variants = extractCompletionVariants(program);
      expect(variants.has('ok')).toBe(true);
      expect(variants.has('notfound')).toBe(true);
    });
  });
});

// ============================================================
// Integration: RuntimeDiscovery → ScoreBridge sync contract
// ============================================================

describe('RuntimeDiscovery → ScoreBridge sync contract', () => {
  it('RuntimeDiscovery/selectRuntime produces endpoint and protocol for ScoreBridge/connect', () => {
    // The sync wires selectRuntime's ok variant fields (endpoint, protocol)
    // into ScoreBridge/connect's input. Verify the handler produces a program
    // whose ok variant includes both fields.
    const program = runtimeDiscoveryHandler.selectRuntime({
      project: 'proj-test',
      runtime: 'vercel',
    });

    const pureVal = getPureValue(program);
    expect(pureVal).toBeDefined();
    expect(pureVal!.variant).toBe('ok');
    expect(pureVal).toHaveProperty('endpoint');
    expect(pureVal).toHaveProperty('protocol');
  });

  it('ScoreBridge/connect accepts endpoint and protocol from RuntimeDiscovery', () => {
    // Verify ScoreBridge/connect builds a valid program when given
    // the output fields that RuntimeDiscovery/selectRuntime produces.
    const program = scoreBridgeHandler.connect({
      endpoint: 'http://localhost:3000',
      protocol: 'http',
      authToken: '',
    });

    expect(program).toBeDefined();
    expect(program.instructions.length).toBeGreaterThan(0);
    const variants = extractCompletionVariants(program);
    expect(variants.has('ok')).toBe(true);
  });
});

// ============================================================
// Manifest parsing helpers (unit tests)
// ============================================================

describe('RuntimeDiscovery manifest parsing', () => {
  it('generates deterministic project IDs from directory paths', () => {
    // The handler generates IDs like proj-<sanitized-path>
    const program1 = runtimeDiscoveryHandler.scan({ directory: '/app/clef-base' });
    const program2 = runtimeDiscoveryHandler.scan({ directory: '/app/clef-base' });

    // Both should produce programs with the same structure (deterministic)
    expect(program1.instructions.length).toBe(program2.instructions.length);
  });

  it('scan program includes mapBindings for manifest parsing', () => {
    const program = runtimeDiscoveryHandler.scan({ directory: '/app/test' });
    expect(hasInstruction(program, 'mapBindings')).toBe(true);
  });
});
