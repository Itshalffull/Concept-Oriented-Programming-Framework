// LatticeMerge provider tests -- CRDT lattice join semantics for conflict-free merging.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { latticeMergeHandler, resetLatticeMergeCounter } from '../handlers/ts/lattice-merge.handler.js';

describe('LatticeMerge', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetLatticeMergeCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await latticeMergeHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('lattice');
      expect(result.category).toBe('merge');
      expect(result.contentTypes).toContain('application/crdt+json');
    });
  });

  describe('execute -- g-counter', () => {
    it('merges g-counters with element-wise max', async () => {
      const base = JSON.stringify({ type: 'g-counter', counters: { a: 0, b: 0 } });
      const ours = JSON.stringify({ type: 'g-counter', counters: { a: 3, b: 1 } });
      const theirs = JSON.stringify({ type: 'g-counter', counters: { a: 1, b: 4 } });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      expect(merged.type).toBe('g-counter');
      expect(merged.counters.a).toBe(3);
      expect(merged.counters.b).toBe(4);
    });

    it('handles new keys in g-counter', async () => {
      const base = JSON.stringify({ type: 'g-counter', counters: {} });
      const ours = JSON.stringify({ type: 'g-counter', counters: { a: 5 } });
      const theirs = JSON.stringify({ type: 'g-counter', counters: { b: 3 } });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      expect(merged.counters.a).toBe(5);
      expect(merged.counters.b).toBe(3);
    });
  });

  describe('execute -- pn-counter', () => {
    it('merges positive-negative counters', async () => {
      const base = JSON.stringify({ type: 'pn-counter', positive: { a: 0 }, negative: { a: 0 } });
      const ours = JSON.stringify({ type: 'pn-counter', positive: { a: 5 }, negative: { a: 1 } });
      const theirs = JSON.stringify({ type: 'pn-counter', positive: { a: 3 }, negative: { a: 2 } });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      expect(merged.positive.a).toBe(5);
      expect(merged.negative.a).toBe(2);
    });
  });

  describe('execute -- or-set', () => {
    it('unions elements and respects tombstones', async () => {
      const base = JSON.stringify({ type: 'or-set', elements: ['x'], tombstones: [] });
      const ours = JSON.stringify({ type: 'or-set', elements: ['x', 'y'], tombstones: [] });
      const theirs = JSON.stringify({ type: 'or-set', elements: ['x', 'z'], tombstones: ['y'] });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      expect(merged.elements).toContain('x');
      expect(merged.elements).toContain('z');
      // 'y' should be excluded due to tombstone
      expect(merged.elements).not.toContain('y');
      expect(merged.tombstones).toContain('y');
    });
  });

  describe('execute -- lww-register', () => {
    it('keeps the value with the highest timestamp', async () => {
      const base = JSON.stringify({ type: 'lww-register', value: 'old', timestamp: 1 });
      const ours = JSON.stringify({ type: 'lww-register', value: 'ours', timestamp: 10 });
      const theirs = JSON.stringify({ type: 'lww-register', value: 'theirs', timestamp: 5 });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      expect(merged.value).toBe('ours');
      expect(merged.timestamp).toBe(10);
    });

    it('picks theirs when its timestamp is higher', async () => {
      const base = JSON.stringify({ type: 'lww-register', value: 'old', timestamp: 1 });
      const ours = JSON.stringify({ type: 'lww-register', value: 'ours', timestamp: 3 });
      const theirs = JSON.stringify({ type: 'lww-register', value: 'theirs', timestamp: 7 });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      const merged = JSON.parse(result.result as string);
      expect(merged.value).toBe('theirs');
    });
  });

  describe('execute -- max-register', () => {
    it('keeps the maximum value', async () => {
      const base = JSON.stringify({ type: 'max-register', value: 0 });
      const ours = JSON.stringify({ type: 'max-register', value: 42 });
      const theirs = JSON.stringify({ type: 'max-register', value: 99 });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      expect(merged.value).toBe(99);
    });
  });

  describe('execute -- error cases', () => {
    it('returns unsupportedContent for incompatible CRDT types', async () => {
      const base = JSON.stringify({ type: 'g-counter', counters: {} });
      const ours = JSON.stringify({ type: 'g-counter', counters: {} });
      const theirs = JSON.stringify({ type: 'or-set', elements: [] });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('unsupportedContent');
    });

    it('returns unsupportedContent for invalid JSON', async () => {
      const result = await latticeMergeHandler.execute(
        { base: '{}', ours: 'not-json', theirs: '{}' },
        storage,
      );
      expect(result.variant).toBe('unsupportedContent');
    });

    it('returns unsupportedContent for missing type field', async () => {
      const result = await latticeMergeHandler.execute(
        { base: '{}', ours: '{}', theirs: '{}' },
        storage,
      );
      expect(result.variant).toBe('unsupportedContent');
    });
  });

  describe('execute -- unknown CRDT type (generic merge)', () => {
    it('merges unknown types with union-of-keys strategy', async () => {
      const base = JSON.stringify({ type: 'custom', x: 1 });
      const ours = JSON.stringify({ type: 'custom', x: 2 });
      const theirs = JSON.stringify({ type: 'custom', x: 1, y: 3 });

      const result = await latticeMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const merged = JSON.parse(result.result as string);
      // x changed in ours (differs from base), so ours wins
      expect(merged.x).toBe(2);
      // y is only in theirs
      expect(merged.y).toBe(3);
    });
  });
});
