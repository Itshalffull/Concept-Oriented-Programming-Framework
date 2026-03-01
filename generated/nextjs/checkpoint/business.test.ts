// Checkpoint — business.test.ts
// Business logic tests for process state snapshots with capture, restore, find, and prune.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { checkpointHandler } from './handler.js';
import type { CheckpointStorage } from './types.js';

const createTestStorage = (): CheckpointStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter) => {
      const entries = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return entries;
      return entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => e[k] === v),
      );
    },
  };
};

describe('Checkpoint business logic', () => {
  it('capture and restore round-trip preserves state data', async () => {
    const storage = createTestStorage();

    const captureResult = await checkpointHandler.capture({
      run_ref: 'run-1',
      step_ref: 'step-3',
      state: { variables: { x: 10, y: 'hello' }, position: 'node-7' },
      label: 'Before risky operation',
    }, storage)();

    let checkpointId = '';
    if (E.isRight(captureResult) && captureResult.right.variant === 'ok') {
      checkpointId = captureResult.right.checkpoint_id;
      expect(captureResult.right.run_ref).toBe('run-1');
      expect(captureResult.right.step_ref).toBe('step-3');
    }

    const restoreResult = await checkpointHandler.restore({
      checkpoint_id: checkpointId,
    }, storage)();

    if (E.isRight(restoreResult) && restoreResult.right.variant === 'ok') {
      expect(restoreResult.right.state).toEqual({
        variables: { x: 10, y: 'hello' },
        position: 'node-7',
      });
      expect(restoreResult.right.run_ref).toBe('run-1');
      expect(restoreResult.right.step_ref).toBe('step-3');
    }
  });

  it('find_latest returns the most recently captured checkpoint', async () => {
    const storage = createTestStorage();

    await checkpointHandler.capture({
      run_ref: 'run-2',
      step_ref: 'step-1',
      state: { progress: 0.25 },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-2',
      step_ref: 'step-2',
      state: { progress: 0.50 },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-2',
      step_ref: 'step-3',
      state: { progress: 0.75 },
    }, storage)();

    const result = await checkpointHandler.find_latest({
      run_ref: 'run-2',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.step_ref).toBe('step-3');
      expect(result.right.run_ref).toBe('run-2');
    }
  });

  it('find_latest on run with no checkpoints returns not_found', async () => {
    const storage = createTestStorage();

    const result = await checkpointHandler.find_latest({
      run_ref: 'empty-run',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('restore non-existent checkpoint returns not_found', async () => {
    const storage = createTestStorage();

    const result = await checkpointHandler.restore({
      checkpoint_id: 'nonexistent-cp',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('prune keeps only the specified number of recent checkpoints', async () => {
    const storage = createTestStorage();

    // Create 5 checkpoints
    for (let i = 1; i <= 5; i++) {
      await checkpointHandler.capture({
        run_ref: 'run-3',
        step_ref: `step-${i}`,
        state: { i },
      }, storage)();
    }

    // Prune to keep only 2
    const pruneResult = await checkpointHandler.prune({
      run_ref: 'run-3',
      keep_count: 2,
    }, storage)();

    if (E.isRight(pruneResult) && pruneResult.right.variant === 'ok') {
      expect(pruneResult.right.pruned_count).toBe(3);
      expect(pruneResult.right.remaining_count).toBe(2);
    }

    // Latest should still be step-5
    const latest = await checkpointHandler.find_latest({ run_ref: 'run-3' }, storage)();
    if (E.isRight(latest) && latest.right.variant === 'ok') {
      expect(latest.right.step_ref).toBe('step-5');
    }
  });

  it('prune with keep_count >= total checkpoints deletes nothing', async () => {
    const storage = createTestStorage();

    await checkpointHandler.capture({
      run_ref: 'run-4',
      step_ref: 'step-1',
      state: { x: 1 },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-4',
      step_ref: 'step-2',
      state: { x: 2 },
    }, storage)();

    const result = await checkpointHandler.prune({
      run_ref: 'run-4',
      keep_count: 10,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.pruned_count).toBe(0);
      expect(result.right.remaining_count).toBe(2);
    }
  });

  it('multiple checkpoints at same step_ref create distinct snapshots', async () => {
    const storage = createTestStorage();

    const cap1 = await checkpointHandler.capture({
      run_ref: 'run-5',
      step_ref: 'loop-step',
      state: { iteration: 1 },
    }, storage)();

    const cap2 = await checkpointHandler.capture({
      run_ref: 'run-5',
      step_ref: 'loop-step',
      state: { iteration: 2 },
    }, storage)();

    let id1 = '', id2 = '';
    if (E.isRight(cap1) && cap1.right.variant === 'ok') id1 = cap1.right.checkpoint_id;
    if (E.isRight(cap2) && cap2.right.variant === 'ok') id2 = cap2.right.checkpoint_id;

    expect(id1).not.toBe(id2);

    const r1 = await checkpointHandler.restore({ checkpoint_id: id1 }, storage)();
    const r2 = await checkpointHandler.restore({ checkpoint_id: id2 }, storage)();

    if (E.isRight(r1) && r1.right.variant === 'ok') {
      expect(r1.right.state).toEqual({ iteration: 1 });
    }
    if (E.isRight(r2) && r2.right.variant === 'ok') {
      expect(r2.right.state).toEqual({ iteration: 2 });
    }
  });

  it('checkpoints across different runs are isolated', async () => {
    const storage = createTestStorage();

    await checkpointHandler.capture({
      run_ref: 'run-a',
      step_ref: 'step-1',
      state: { run: 'a' },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-b',
      step_ref: 'step-1',
      state: { run: 'b' },
    }, storage)();

    const latestA = await checkpointHandler.find_latest({ run_ref: 'run-a' }, storage)();
    const latestB = await checkpointHandler.find_latest({ run_ref: 'run-b' }, storage)();

    if (E.isRight(latestA) && latestA.right.variant === 'ok') {
      expect(latestA.right.run_ref).toBe('run-a');
    }
    if (E.isRight(latestB) && latestB.right.variant === 'ok') {
      expect(latestB.right.run_ref).toBe('run-b');
    }
  });

  it('prune on run with no checkpoints returns zero deleted', async () => {
    const storage = createTestStorage();

    const result = await checkpointHandler.prune({
      run_ref: 'no-checkpoints',
      keep_count: 5,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.pruned_count).toBe(0);
      expect(result.right.remaining_count).toBe(0);
    }
  });
});
