// ============================================================
// Parallel Interpreter Tests — Applicative Parallelism
//
// Tests for the parallelInterpret function which dispatches to the
// ParallelismProvider concept (via its handler) to analyze program
// dependencies, then executes independent instructions concurrently
// via Promise.all. The analysis itself goes through the monadic
// pipeline — full traceability.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret, parallelInterpret } from '../runtime/interpreter.js';
import { parallelismProviderHandler } from '../handlers/ts/monadic/providers/parallelism-provider.handler.js';
import {
  createProgram, get, find, put, pure, pureFrom,
} from '../runtime/storage-program.js';

describe('parallelInterpret', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----------------------------------------------------------
  // Correctness: same results as sequential interpret
  // ----------------------------------------------------------

  describe('correctness', () => {
    it('produces same result as sequential interpret for independent gets', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.put('orders', 'o1', { total: 99 });

      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'user');
      prog = get(prog, 'orders', 'o1', 'order');
      prog = pureFrom(prog, (bindings) => ({
        variant: 'ok',
        userName: (bindings.user as any)?.name,
        orderTotal: (bindings.order as any)?.total,
      }));

      const seqResult = await interpret(prog, storage);
      const parResult = await parallelInterpret(prog, storage, parallelismProviderHandler);

      expect(parResult.variant).toBe(seqResult.variant);
      expect(parResult.output.userName).toBe('Alice');
      expect(parResult.output.orderTotal).toBe(99);
    });

    it('produces same result as sequential interpret for finds', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.put('users', 'u2', { name: 'Bob' });
      await storage.put('orders', 'o1', { total: 42 });

      let prog = createProgram();
      prog = find(prog, 'users', {}, 'allUsers');
      prog = find(prog, 'orders', {}, 'allOrders');
      prog = pureFrom(prog, (bindings) => ({
        variant: 'ok',
        userCount: (bindings.allUsers as any[])?.length,
        orderCount: (bindings.allOrders as any[])?.length,
      }));

      const seqResult = await interpret(prog, storage);
      const parResult = await parallelInterpret(prog, storage, parallelismProviderHandler);

      expect(parResult.variant).toBe(seqResult.variant);
      expect(parResult.output.userCount).toBe(seqResult.output.userCount);
      expect(parResult.output.orderCount).toBe(seqResult.output.orderCount);
    });

    it('produces same result for write-then-read programs', async () => {
      let prog = createProgram();
      prog = put(prog, 'users', 'u1', { name: 'Alice' });
      prog = get(prog, 'users', 'u1', 'user');
      prog = pureFrom(prog, (bindings) => ({
        variant: 'ok',
        name: (bindings.user as any)?.name,
      }));

      const seqResult = await interpret(prog, storage);

      // Reset storage for parallel run
      storage = createInMemoryStorage();
      const parResult = await parallelInterpret(prog, storage, parallelismProviderHandler);

      expect(parResult.variant).toBe(seqResult.variant);
      expect(parResult.output.name).toBe('Alice');
    });
  });

  // ----------------------------------------------------------
  // Parallel layers reported in result
  // ----------------------------------------------------------

  describe('layer reporting', () => {
    it('reports multiple layers for programs with parallelism', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.put('orders', 'o1', { total: 99 });

      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'user');
      prog = get(prog, 'orders', 'o1', 'order');
      prog = pureFrom(prog, (bindings) => ({
        variant: 'ok',
        user: bindings.user,
        order: bindings.order,
      }));

      const result = await parallelInterpret(prog, storage, parallelismProviderHandler);

      expect(result.variant).toBe('ok');
      // Layer 1: two gets in parallel, Layer 2: pureFrom
      expect(result.parallelLayers).toBe(2);
    });

    it('reports single layer fallback for purely sequential program', async () => {
      let prog = createProgram();
      prog = pure(prog, { variant: 'ok', msg: 'done' });

      const result = await parallelInterpret(prog, storage, parallelismProviderHandler);

      expect(result.variant).toBe('ok');
      expect(result.output.msg).toBe('done');
      // Sequential fallback
      expect(result.parallelLayers).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Analysis trace included
  // ----------------------------------------------------------

  describe('trace includes analysis', () => {
    it('includes analysis steps in the execution trace', async () => {
      await storage.put('users', 'u1', { name: 'Alice' });
      await storage.put('orders', 'o1', { total: 99 });

      let prog = createProgram();
      prog = get(prog, 'users', 'u1', 'user');
      prog = get(prog, 'orders', 'o1', 'order');
      prog = pure(prog, { variant: 'ok' });

      const result = await parallelInterpret(prog, storage, parallelismProviderHandler);

      // The trace should include steps from the analysis program (put + pure)
      // as well as from the actual program execution (2 gets + pure)
      expect(result.trace.steps.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ----------------------------------------------------------
  // Storage side effects preserved
  // ----------------------------------------------------------

  describe('storage effects', () => {
    it('persists writes correctly during parallel execution', async () => {
      let prog = createProgram();
      prog = put(prog, 'users', 'u1', { name: 'Alice' });
      prog = put(prog, 'orders', 'o1', { total: 42 });
      prog = pure(prog, { variant: 'ok' });

      await parallelInterpret(prog, storage, parallelismProviderHandler);

      const user = await storage.get('users', 'u1');
      const order = await storage.get('orders', 'o1');
      expect(user).toEqual({ name: 'Alice' });
      expect(order).toEqual({ total: 42 });
    });
  });

  // ----------------------------------------------------------
  // Provider dispatched through concept system
  // ----------------------------------------------------------

  describe('concept dispatch', () => {
    it('dispatches analysis to the provider handler, not bypassing the concept system', async () => {
      let prog = createProgram();
      prog = get(prog, 'a', 'k1', 'r1');
      prog = get(prog, 'b', 'k2', 'r2');
      prog = pure(prog, { variant: 'ok' });

      const result = await parallelInterpret(prog, storage, parallelismProviderHandler);

      // The provider stores its analysis result — verify it went through
      // the monadic pipeline by checking the 'results' collection
      const allResults = await storage.find('results', {});
      expect(allResults.length).toBeGreaterThanOrEqual(1);
      const analysisResult = allResults[0] as Record<string, unknown>;
      expect(analysisResult.maxParallelism).toBeGreaterThanOrEqual(2);
    });
  });
});
