// Checkpoint — conformance.test.ts
// Conformance tests for process state snapshots with capture, restore, find, and prune.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { checkpointHandler } from './handler.js';
import type { CheckpointStorage } from './types.js';

// In-memory storage for conformance tests
const createTestStorage = (): CheckpointStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

describe('Checkpoint conformance', () => {
  it('capture creates a checkpoint with state snapshot', async () => {
    const storage = createTestStorage();
    const result = await checkpointHandler.capture({
      run_ref: 'run-1',
      step_ref: 'step-3',
      state: { counter: 42, items: ['a', 'b'] },
      label: 'after-processing',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.run_ref).toBe('run-1');
      expect(result.right.step_ref).toBe('step-3');
      expect(result.right.captured_at).toBeTruthy();
    }
  });

  it('restore returns the captured state', async () => {
    const storage = createTestStorage();
    const captureResult = await checkpointHandler.capture({
      run_ref: 'run-1',
      step_ref: 'step-1',
      state: { progress: 0.5, data: { key: 'value' } },
    }, storage)();

    let checkpointId = '';
    if (E.isRight(captureResult) && captureResult.right.variant === 'ok') {
      checkpointId = captureResult.right.checkpoint_id;
    }

    const result = await checkpointHandler.restore({
      checkpoint_id: checkpointId,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.state).toEqual({ progress: 0.5, data: { key: 'value' } });
        expect(result.right.run_ref).toBe('run-1');
        expect(result.right.step_ref).toBe('step-1');
      }
    }
  });

  it('restore returns not_found for unknown checkpoint', async () => {
    const storage = createTestStorage();
    const result = await checkpointHandler.restore({
      checkpoint_id: 'nonexistent',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('find_latest returns the most recent checkpoint for a run', async () => {
    const storage = createTestStorage();

    await checkpointHandler.capture({
      run_ref: 'run-2',
      step_ref: 'step-1',
      state: { phase: 'first' },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-2',
      step_ref: 'step-2',
      state: { phase: 'second' },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-2',
      step_ref: 'step-3',
      state: { phase: 'third' },
    }, storage)();

    const result = await checkpointHandler.find_latest({
      run_ref: 'run-2',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.step_ref).toBe('step-3');
      }
    }
  });

  it('find_latest returns not_found when no checkpoints exist', async () => {
    const storage = createTestStorage();
    const result = await checkpointHandler.find_latest({
      run_ref: 'run-nonexistent',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('prune removes old checkpoints keeping only recent ones', async () => {
    const storage = createTestStorage();

    // Capture 5 checkpoints
    for (let i = 1; i <= 5; i++) {
      await checkpointHandler.capture({
        run_ref: 'run-3',
        step_ref: `step-${i}`,
        state: { index: i },
      }, storage)();
    }

    // Prune keeping only 2
    const result = await checkpointHandler.prune({
      run_ref: 'run-3',
      keep_count: 2,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.pruned_count).toBe(3);
      expect(result.right.remaining_count).toBe(2);
    }

    // find_latest should still work and return the most recent
    const latest = await checkpointHandler.find_latest({
      run_ref: 'run-3',
    }, storage)();

    expect(E.isRight(latest)).toBe(true);
    if (E.isRight(latest)) {
      expect(latest.right.variant).toBe('ok');
      if (latest.right.variant === 'ok') {
        expect(latest.right.step_ref).toBe('step-5');
      }
    }
  });

  it('prune does nothing when fewer checkpoints than keep_count', async () => {
    const storage = createTestStorage();

    await checkpointHandler.capture({
      run_ref: 'run-4',
      step_ref: 'only-one',
      state: { solo: true },
    }, storage)();

    const result = await checkpointHandler.prune({
      run_ref: 'run-4',
      keep_count: 5,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.pruned_count).toBe(0);
      expect(result.right.remaining_count).toBe(1);
    }
  });

  it('prune with no checkpoints returns zero counts', async () => {
    const storage = createTestStorage();
    const result = await checkpointHandler.prune({
      run_ref: 'run-empty',
      keep_count: 3,
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      expect(result.right.pruned_count).toBe(0);
      expect(result.right.remaining_count).toBe(0);
    }
  });

  it('full lifecycle: capture multiple -> find_latest -> restore -> prune', async () => {
    const storage = createTestStorage();

    // Capture 3 checkpoints
    await checkpointHandler.capture({
      run_ref: 'run-5',
      step_ref: 'init',
      state: { status: 'initialized', count: 0 },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-5',
      step_ref: 'processing',
      state: { status: 'processing', count: 50 },
    }, storage)();

    await checkpointHandler.capture({
      run_ref: 'run-5',
      step_ref: 'almost-done',
      state: { status: 'almost_done', count: 99 },
    }, storage)();

    // Find latest
    const latest = await checkpointHandler.find_latest({ run_ref: 'run-5' }, storage)();
    expect(E.isRight(latest)).toBe(true);

    let latestId = '';
    if (E.isRight(latest) && latest.right.variant === 'ok') {
      latestId = latest.right.checkpoint_id;
      expect(latest.right.step_ref).toBe('almost-done');
    }

    // Restore the latest
    const restored = await checkpointHandler.restore({ checkpoint_id: latestId }, storage)();
    expect(E.isRight(restored)).toBe(true);
    if (E.isRight(restored) && restored.right.variant === 'ok') {
      expect(restored.right.state).toEqual({ status: 'almost_done', count: 99 });
    }

    // Prune to keep only 1
    const pruned = await checkpointHandler.prune({
      run_ref: 'run-5',
      keep_count: 1,
    }, storage)();
    expect(E.isRight(pruned)).toBe(true);
    if (E.isRight(pruned)) {
      expect(pruned.right.variant).toBe('ok');
      expect(pruned.right.pruned_count).toBe(2);
      expect(pruned.right.remaining_count).toBe(1);
    }
  });
});
