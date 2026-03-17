// ============================================================
// ParallelismProvider Tests — Monadic
//
// Tests for analyzing StorageProgram instruction lists to identify
// independent instruction groups for concurrent execution. All
// analysis goes through the monadic pipeline via the interpreter.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret } from '../runtime/interpreter.js';
import { parallelismProviderHandler } from '../handlers/ts/monadic/providers/parallelism-provider.handler.js';
import {
  createProgram, get, find, put, del, branch, pure, pureFrom,
  serializeProgram,
} from '../runtime/storage-program.js';

describe('ParallelismProvider (Monadic)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // ----------------------------------------------------------
  // Independent gets — should parallelize
  // ----------------------------------------------------------

  describe('independent gets', () => {
    it('detects two independent get instructions as parallelizable', async () => {
      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'userResult');
      prog = get(prog, 'orders', 'o1', 'orderResult');
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      expect(result.maxParallelism).toBeGreaterThanOrEqual(2);
      expect(result.speedupRatio).toBeGreaterThan(1);

      const layers = JSON.parse(result.layers as string);
      // First layer should contain both gets
      expect(layers[0]).toHaveLength(2);
      expect(layers[0]).toContain(0);
      expect(layers[0]).toContain(1);
    });

    it('detects three independent gets as parallelizable', async () => {
      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'a');
      prog = get(prog, 'orders', 'o1', 'b');
      prog = get(prog, 'products', 'p1', 'c');
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      expect(result.maxParallelism).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // Independent finds — should parallelize
  // ----------------------------------------------------------

  describe('independent finds', () => {
    it('detects two independent find instructions as parallelizable', async () => {
      let prog = createProgram();
      prog = find(prog, 'users', {}, 'allUsers');
      prog = find(prog, 'orders', {}, 'allOrders');
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      expect(result.maxParallelism).toBeGreaterThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------
  // Dependent chain — should be sequential
  // ----------------------------------------------------------

  describe('dependent chain', () => {
    it('reports sequential when get is followed by pureFrom that reads bindings', async () => {
      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'user');
      prog = pureFrom(prog, (bindings) => ({ variant: 'ok', data: bindings.user }));

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      // pureFrom depends on the get's binding — fully sequential
      expect(result.variant).toBe('sequential');
      expect(result.reason).toBeTruthy();
    });
  });

  // ----------------------------------------------------------
  // Mixed parallel and sequential
  // ----------------------------------------------------------

  describe('mixed dependencies', () => {
    it('detects parallel layer then sequential dependency', async () => {
      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'user');
      prog = get(prog, 'orders', 'o1', 'order');
      // pureFrom depends on both bindings — must wait for both gets
      prog = pureFrom(prog, (bindings) => ({
        variant: 'ok',
        user: bindings.user,
        order: bindings.order,
      }));

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      const layers = JSON.parse(result.layers as string);
      // Layer 0: both gets in parallel, Layer 1: pureFrom
      expect(layers).toHaveLength(2);
      expect(layers[0]).toHaveLength(2);
      expect(layers[1]).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // Write ordering — same relation
  // ----------------------------------------------------------

  describe('write ordering', () => {
    it('serializes writes to the same relation', async () => {
      let prog = createProgram();
      prog = put(prog, 'users', 'u1', { name: 'Alice' });
      prog = put(prog, 'users', 'u2', { name: 'Bob' });
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      // WAW on 'users' means the two puts can't be parallel — sequential
      expect(result.variant).toBe('sequential');
    });

    it('allows parallel writes to different relations', async () => {
      let prog = createProgram();
      prog = put(prog, 'users', 'u1', { name: 'Alice' });
      prog = put(prog, 'orders', 'o1', { total: 42 });
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      const layers = JSON.parse(result.layers as string);
      // Writes to different relations should be in the same layer
      expect(layers[0]).toContain(0);
      expect(layers[0]).toContain(1);
    });
  });

  // ----------------------------------------------------------
  // Read-after-write hazard
  // ----------------------------------------------------------

  describe('RAW hazard', () => {
    it('prevents reading a relation that was just written', async () => {
      let prog = createProgram();
      prog = put(prog, 'users', 'u1', { name: 'Alice' });
      prog = get(prog, 'users', 'u1', 'fetchedUser');
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      // RAW on 'users' — put then get on same relation must be sequential
      expect(result.variant).toBe('sequential');
    });
  });

  // ----------------------------------------------------------
  // Empty / single instruction programs
  // ----------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty program', async () => {
      const prog = createProgram();
      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      // No instructions — sequential (maxParallelism 0)
      expect(result.variant).toBe('sequential');
    });

    it('handles single instruction program', async () => {
      let prog = createProgram();
      prog = pure(prog, { variant: 'ok' });
      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('sequential');
    });

    it('returns error for invalid JSON', async () => {
      const result = await run(parallelismProviderHandler.analyze({ program: 'not-json' }));
      expect(result.variant).toBe('error');
    });
  });

  // ----------------------------------------------------------
  // Speedup ratio calculation
  // ----------------------------------------------------------

  describe('speedup ratio', () => {
    it('calculates correct speedup for fully parallel program', async () => {
      let prog = createProgram();
      prog = get(prog, 'a', 'k1', 'r1');
      prog = get(prog, 'b', 'k2', 'r2');
      prog = get(prog, 'c', 'k3', 'r3');
      prog = get(prog, 'd', 'k4', 'r4');
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      // 5 instructions (4 gets + pure), 2 layers (all gets parallel + pure)
      // speedup = 5 / 2 = 2.5
      expect(result.speedupRatio).toBeGreaterThan(1);
    });
  });

  // ----------------------------------------------------------
  // Analysis result is stored (dogfooding: put + pure pattern)
  // ----------------------------------------------------------

  describe('result storage', () => {
    it('stores analysis result in storage via the monadic pipeline', async () => {
      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'a');
      prog = get(prog, 'orders', 'o1', 'b');
      prog = pure(prog, { variant: 'ok' });

      const serialized = serializeProgram(prog);
      const result = await run(parallelismProviderHandler.analyze({ program: serialized }));

      expect(result.variant).toBe('ok');
      // The handler puts the result into 'results' collection
      const resultId = result.result as string;
      expect(resultId).toBeTruthy();
      const stored = await storage.get('results', resultId);
      expect(stored).not.toBeNull();
      expect(stored!.maxParallelism).toBeGreaterThanOrEqual(2);
    });
  });
});
