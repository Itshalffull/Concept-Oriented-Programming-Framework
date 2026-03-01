// Timer — business.test.ts
// Business logic tests for time-based triggers with date, duration, and cycle types.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { timerHandler } from './handler.js';
import type { TimerStorage } from './types.js';

const createTestStorage = (): TimerStorage => {
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

describe('Timer business logic', () => {
  it('date timer creates with correct next_fire_at', async () => {
    const storage = createTestStorage();

    const result = await timerHandler.set_timer({
      run_ref: 'run-1',
      purpose_tag: 'deadline',
      timer_type: 'date',
      specification: '2030-12-31T23:59:59Z',
      context_ref: 'order-123',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.next_fire_at).toBe('2030-12-31T23:59:59.000Z');
      expect(result.right.run_ref).toBe('run-1');
    }
  });

  it('duration timer computes next_fire_at relative to now', async () => {
    const storage = createTestStorage();

    const before = Date.now();
    const result = await timerHandler.set_timer({
      run_ref: 'run-2',
      purpose_tag: 'timeout',
      timer_type: 'duration',
      specification: 'PT30M',
      context_ref: 'step-x',
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      const fireAt = new Date(result.right.next_fire_at).getTime();
      // 30 minutes = 1800000ms, allow 5 second window
      expect(fireAt).toBeGreaterThanOrEqual(before + 1800000 - 5000);
      expect(fireAt).toBeLessThanOrEqual(before + 1800000 + 5000);
    }
  });

  it('invalid specification returns invalid_spec', async () => {
    const storage = createTestStorage();

    const result = await timerHandler.set_timer({
      run_ref: 'run-3',
      purpose_tag: 'bad',
      timer_type: 'date',
      specification: 'not-a-date',
      context_ref: 'step',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_spec');
    }
  });

  it('fire a duration timer transitions to fired status', async () => {
    const storage = createTestStorage();

    const setResult = await timerHandler.set_timer({
      run_ref: 'run-4',
      purpose_tag: 'one-shot',
      timer_type: 'duration',
      specification: 'PT1S',
      context_ref: 'ctx',
    }, storage)();

    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fireResult)).toBe(true);
    if (E.isRight(fireResult) && fireResult.right.variant === 'ok') {
      expect(fireResult.right.run_ref).toBe('run-4');
      expect(fireResult.right.purpose_tag).toBe('one-shot');
    }
  });

  it('fire a cycle timer remains active for subsequent fires', async () => {
    const storage = createTestStorage();

    const setResult = await timerHandler.set_timer({
      run_ref: 'run-5',
      purpose_tag: 'heartbeat',
      timer_type: 'cycle',
      specification: 'PT5M',
      context_ref: 'monitor',
    }, storage)();

    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    // Fire multiple times - cycle timer should stay active
    for (let i = 0; i < 3; i++) {
      const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
      expect(E.isRight(fireResult)).toBe(true);
      if (E.isRight(fireResult)) {
        expect(fireResult.right.variant).toBe('ok');
      }
    }

    // Timer should still be fireable (not transitioned to fired)
    const fireResult4 = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fireResult4)).toBe(true);
    if (E.isRight(fireResult4)) {
      expect(fireResult4.right.variant).toBe('ok');
    }
  });

  it('cancel an active timer transitions to cancelled', async () => {
    const storage = createTestStorage();

    const setResult = await timerHandler.set_timer({
      run_ref: 'run-6',
      purpose_tag: 'cancellable',
      timer_type: 'duration',
      specification: 'PT1H',
      context_ref: 'ctx',
    }, storage)();

    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    const cancelResult = await timerHandler.cancel({ timer_id: timerId }, storage)();
    expect(E.isRight(cancelResult)).toBe(true);
    if (E.isRight(cancelResult)) {
      expect(cancelResult.right.variant).toBe('ok');
    }
  });

  it('fire a cancelled timer returns not_active', async () => {
    const storage = createTestStorage();

    const setResult = await timerHandler.set_timer({
      run_ref: 'run-7',
      purpose_tag: 'gone',
      timer_type: 'duration',
      specification: 'PT10M',
      context_ref: 'ctx',
    }, storage)();

    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    await timerHandler.cancel({ timer_id: timerId }, storage)();

    const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
    if (E.isRight(fireResult)) {
      expect(fireResult.right.variant).toBe('not_active');
    }
  });

  it('fire a non-existent timer returns not_active', async () => {
    const storage = createTestStorage();

    const result = await timerHandler.fire({ timer_id: 'nonexistent-timer' }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_active');
    }
  });

  it('reset a fired timer reactivates it with new specification', async () => {
    const storage = createTestStorage();

    const setResult = await timerHandler.set_timer({
      run_ref: 'run-8',
      purpose_tag: 'resettable',
      timer_type: 'duration',
      specification: 'PT1S',
      context_ref: 'ctx',
    }, storage)();

    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    await timerHandler.fire({ timer_id: timerId }, storage)();

    const resetResult = await timerHandler.reset({
      timer_id: timerId,
      specification: 'PT2H',
    }, storage)();

    expect(E.isRight(resetResult)).toBe(true);
    if (E.isRight(resetResult) && resetResult.right.variant === 'ok') {
      expect(resetResult.right.next_fire_at).toBeTruthy();
    }

    // Timer should now be fireable again
    const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
    if (E.isRight(fireResult)) {
      expect(fireResult.right.variant).toBe('ok');
    }
  });

  it('reset a non-existent timer returns not_found', async () => {
    const storage = createTestStorage();

    const result = await timerHandler.reset({
      timer_id: 'ghost-timer',
      specification: 'PT1H',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('zero-duration specification returns invalid_spec', async () => {
    const storage = createTestStorage();

    const result = await timerHandler.set_timer({
      run_ref: 'run-10',
      purpose_tag: 'zero',
      timer_type: 'duration',
      specification: 'PT0S',
      context_ref: 'ctx',
    }, storage)();

    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_spec');
    }
  });
});
