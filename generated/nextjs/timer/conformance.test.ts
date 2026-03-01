// Timer — conformance.test.ts
// Conformance tests for time-based triggers: date, duration, and cycle timer types.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

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

describe('Timer conformance', () => {
  it('invariant: set_timer creates an active timer with computed next_fire_at', async () => {
    const storage = createTestStorage();
    const result = await timerHandler.set_timer({
      run_ref: 'run-1',
      timer_type: 'duration',
      specification: 'PT30M',
      purpose_tag: 'retry',
      context_ref: 'step-1',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.run_ref).toBe('run-1');
        expect(result.right.next_fire_at).toBeDefined();
        // next_fire_at should be ~30 minutes from now
        const fireAt = new Date(result.right.next_fire_at).getTime();
        const now = Date.now();
        expect(fireAt).toBeGreaterThan(now);
        expect(fireAt).toBeLessThan(now + 31 * 60 * 1000);
      }
    }
  });

  it('invariant: set_timer with date type uses absolute datetime', async () => {
    const storage = createTestStorage();
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const result = await timerHandler.set_timer({
      run_ref: 'run-2',
      timer_type: 'date',
      specification: futureDate,
      purpose_tag: 'sla',
      context_ref: 'step-2',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('ok');
      if (result.right.variant === 'ok') {
        expect(result.right.next_fire_at).toBe(new Date(futureDate).toISOString());
      }
    }
  });

  it('invariant: set_timer returns invalid_spec for unparseable specification', async () => {
    const storage = createTestStorage();
    const result = await timerHandler.set_timer({
      run_ref: 'run-3',
      timer_type: 'duration',
      specification: 'not-a-duration',
      purpose_tag: 'retry',
      context_ref: 'step-3',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_spec');
      if (result.right.variant === 'invalid_spec') {
        expect(result.right.specification).toBe('not-a-duration');
      }
    }
  });

  it('invariant: fire transitions duration timer from active to fired', async () => {
    const storage = createTestStorage();
    const setResult = await timerHandler.set_timer({
      run_ref: 'run-4',
      timer_type: 'duration',
      specification: 'PT1H',
      purpose_tag: 'escalation',
      context_ref: 'case-1',
    }, storage)();

    expect(E.isRight(setResult)).toBe(true);
    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fireResult)).toBe(true);
    if (E.isRight(fireResult)) {
      expect(fireResult.right.variant).toBe('ok');
      if (fireResult.right.variant === 'ok') {
        expect(fireResult.right.run_ref).toBe('run-4');
        expect(fireResult.right.purpose_tag).toBe('escalation');
        expect(fireResult.right.context_ref).toBe('case-1');
      }
    }

    // Firing again should fail (already fired)
    const secondFire = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(secondFire)).toBe(true);
    if (E.isRight(secondFire)) {
      expect(secondFire.right.variant).toBe('not_active');
    }
  });

  it('invariant: fire on cycle timer remains active and computes next_fire_at', async () => {
    const storage = createTestStorage();
    const setResult = await timerHandler.set_timer({
      run_ref: 'run-5',
      timer_type: 'cycle',
      specification: 'PT10M',
      purpose_tag: 'schedule',
      context_ref: 'job-1',
    }, storage)();

    expect(E.isRight(setResult)).toBe(true);
    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    // First fire
    const fire1 = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fire1)).toBe(true);
    if (E.isRight(fire1)) {
      expect(fire1.right.variant).toBe('ok');
    }

    // Second fire should still work (cycle remains active)
    const fire2 = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fire2)).toBe(true);
    if (E.isRight(fire2)) {
      expect(fire2.right.variant).toBe('ok');
    }
  });

  it('invariant: cancel transitions active timer to cancelled', async () => {
    const storage = createTestStorage();
    const setResult = await timerHandler.set_timer({
      run_ref: 'run-6',
      timer_type: 'duration',
      specification: 'PT5M',
      purpose_tag: 'retry',
      context_ref: 'step-6',
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

    // Firing a cancelled timer fails
    const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fireResult)).toBe(true);
    if (E.isRight(fireResult)) {
      expect(fireResult.right.variant).toBe('not_active');
    }
  });

  it('invariant: cancel rejects non-active timers', async () => {
    const storage = createTestStorage();
    const result = await timerHandler.cancel({ timer_id: 'nonexistent' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_active');
    }
  });

  it('invariant: reset reactivates a fired timer with new specification', async () => {
    const storage = createTestStorage();
    const setResult = await timerHandler.set_timer({
      run_ref: 'run-7',
      timer_type: 'duration',
      specification: 'PT1M',
      purpose_tag: 'retry',
      context_ref: 'step-7',
    }, storage)();

    let timerId = '';
    if (E.isRight(setResult) && setResult.right.variant === 'ok') {
      timerId = setResult.right.timer_id;
    }

    // Fire the timer
    await timerHandler.fire({ timer_id: timerId }, storage)();

    // Reset with new specification
    const resetResult = await timerHandler.reset({
      timer_id: timerId,
      specification: 'PT2H',
    }, storage)();

    expect(E.isRight(resetResult)).toBe(true);
    if (E.isRight(resetResult)) {
      expect(resetResult.right.variant).toBe('ok');
      if (resetResult.right.variant === 'ok') {
        expect(resetResult.right.next_fire_at).toBeDefined();
      }
    }

    // Timer should be active again and can be fired
    const fireResult = await timerHandler.fire({ timer_id: timerId }, storage)();
    expect(E.isRight(fireResult)).toBe(true);
    if (E.isRight(fireResult)) {
      expect(fireResult.right.variant).toBe('ok');
    }
  });

  it('invariant: reset returns not_found for unknown timer_id', async () => {
    const storage = createTestStorage();
    const result = await timerHandler.reset({
      timer_id: 'nonexistent',
      specification: 'PT1H',
    }, storage)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });
});
