import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  getVisibleFields,
  detectCircularConditions,
  parseConditions,
  type FieldCondition,
} from '../form-conditions';

// ─── evaluateCondition ────────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('equals: matches identical string values', () => {
    expect(evaluateCondition({ field: 'status', operator: 'equals', value: 'active' }, { status: 'active' })).toBe(true);
    expect(evaluateCondition({ field: 'status', operator: 'equals', value: 'active' }, { status: 'inactive' })).toBe(false);
  });

  it('equals: coerces numbers to strings for comparison', () => {
    expect(evaluateCondition({ field: 'count', operator: 'equals', value: 5 }, { count: 5 })).toBe(true);
    expect(evaluateCondition({ field: 'count', operator: 'equals', value: '5' }, { count: 5 })).toBe(true);
    expect(evaluateCondition({ field: 'count', operator: 'equals', value: 5 }, { count: '5' })).toBe(true);
  });

  it('not-equals: returns true when values differ', () => {
    expect(evaluateCondition({ field: 'role', operator: 'not-equals', value: 'admin' }, { role: 'user' })).toBe(true);
    expect(evaluateCondition({ field: 'role', operator: 'not-equals', value: 'admin' }, { role: 'admin' })).toBe(false);
  });

  it('contains: checks substring presence', () => {
    expect(evaluateCondition({ field: 'name', operator: 'contains', value: 'foo' }, { name: 'foobar' })).toBe(true);
    expect(evaluateCondition({ field: 'name', operator: 'contains', value: 'baz' }, { name: 'foobar' })).toBe(false);
  });

  it('is-empty: true for null, undefined, empty string, empty array', () => {
    expect(evaluateCondition({ field: 'x', operator: 'is-empty' }, { x: null })).toBe(true);
    expect(evaluateCondition({ field: 'x', operator: 'is-empty' }, { x: undefined })).toBe(true);
    expect(evaluateCondition({ field: 'x', operator: 'is-empty' }, { x: '' })).toBe(true);
    expect(evaluateCondition({ field: 'x', operator: 'is-empty' }, { x: [] })).toBe(true);
    expect(evaluateCondition({ field: 'x', operator: 'is-empty' }, { x: 'hello' })).toBe(false);
    expect(evaluateCondition({ field: 'x', operator: 'is-empty' }, { x: ['a'] })).toBe(false);
  });

  it('is-not-empty: inverse of is-empty', () => {
    expect(evaluateCondition({ field: 'x', operator: 'is-not-empty' }, { x: 'value' })).toBe(true);
    expect(evaluateCondition({ field: 'x', operator: 'is-not-empty' }, { x: '' })).toBe(false);
    expect(evaluateCondition({ field: 'x', operator: 'is-not-empty' }, { x: null })).toBe(false);
  });

  it('any-of: true when value is in the target array', () => {
    expect(evaluateCondition({ field: 'color', operator: 'any-of', value: ['red', 'blue'] }, { color: 'red' })).toBe(true);
    expect(evaluateCondition({ field: 'color', operator: 'any-of', value: ['red', 'blue'] }, { color: 'green' })).toBe(false);
    expect(evaluateCondition({ field: 'color', operator: 'any-of', value: 'not-an-array' }, { color: 'red' })).toBe(false);
  });

  it('greater-than: numeric comparison', () => {
    expect(evaluateCondition({ field: 'age', operator: 'greater-than', value: 18 }, { age: 21 })).toBe(true);
    expect(evaluateCondition({ field: 'age', operator: 'greater-than', value: 18 }, { age: 18 })).toBe(false);
    expect(evaluateCondition({ field: 'age', operator: 'greater-than', value: 18 }, { age: 10 })).toBe(false);
  });

  it('less-than: numeric comparison', () => {
    expect(evaluateCondition({ field: 'score', operator: 'less-than', value: 100 }, { score: 42 })).toBe(true);
    expect(evaluateCondition({ field: 'score', operator: 'less-than', value: 100 }, { score: 100 })).toBe(false);
    expect(evaluateCondition({ field: 'score', operator: 'less-than', value: 100 }, { score: 200 })).toBe(false);
  });

  it('is-empty: field not present in values (key missing) treated as empty', () => {
    expect(evaluateCondition({ field: 'missing', operator: 'is-empty' }, {})).toBe(true);
  });
});

// ─── getVisibleFields ─────────────────────────────────────────────────────────

describe('getVisibleFields', () => {
  it('fields with no conditions are always visible', () => {
    const visible = getVisibleFields(['name', 'email'], [], {});
    expect(visible).toEqual(new Set(['name', 'email']));
  });

  it('shows a field when its condition is satisfied', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'details', showWhen: { field: 'type', operator: 'equals', value: 'premium' } },
    ];
    const visible = getVisibleFields(['type', 'details'], conditions, { type: 'premium' });
    expect(visible.has('details')).toBe(true);
  });

  it('hides a field when its condition is not satisfied', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'details', showWhen: { field: 'type', operator: 'equals', value: 'premium' } },
    ];
    const visible = getVisibleFields(['type', 'details'], conditions, { type: 'basic' });
    expect(visible.has('details')).toBe(false);
  });

  it('daisy-chains: hides C when B is hidden (B depends on A, C depends on B)', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'yes' } },
      { fieldId: 'c', showWhen: { field: 'b', operator: 'equals', value: 'done' } },
    ];
    // a is not 'yes', so b is hidden, and c must also be hidden even though
    // b's value might accidentally match if we ignore visibility
    const visible = getVisibleFields(['a', 'b', 'c'], conditions, { a: 'no', b: 'done' });
    expect(visible.has('a')).toBe(true);
    expect(visible.has('b')).toBe(false);
    expect(visible.has('c')).toBe(false);
  });

  it('daisy-chains: shows C when the full chain is satisfied', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'yes' } },
      { fieldId: 'c', showWhen: { field: 'b', operator: 'equals', value: 'done' } },
    ];
    const visible = getVisibleFields(['a', 'b', 'c'], conditions, { a: 'yes', b: 'done' });
    expect(visible.has('b')).toBe(true);
    expect(visible.has('c')).toBe(true);
  });

  it('handles empty values gracefully (is-empty operator)', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'fallback', showWhen: { field: 'primary', operator: 'is-empty' } },
    ];
    const visible = getVisibleFields(['primary', 'fallback'], conditions, { primary: '' });
    expect(visible.has('fallback')).toBe(true);
  });

  it('returns empty set for all conditional fields when root dependency missing from values', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'child', showWhen: { field: 'parent', operator: 'is-not-empty' } },
    ];
    const visible = getVisibleFields(['parent', 'child'], conditions, { parent: null });
    expect(visible.has('child')).toBe(false);
    expect(visible.has('parent')).toBe(true); // parent has no condition
  });

  it('multiple independent conditions work correctly', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'x' } },
      { fieldId: 'd', showWhen: { field: 'c', operator: 'equals', value: 'y' } },
    ];
    const visible = getVisibleFields(['a', 'b', 'c', 'd'], conditions, { a: 'x', c: 'z' });
    expect(visible.has('b')).toBe(true);
    expect(visible.has('d')).toBe(false);
  });
});

// ─── detectCircularConditions ─────────────────────────────────────────────────

describe('detectCircularConditions', () => {
  it('returns null when there are no conditions', () => {
    expect(detectCircularConditions([])).toBeNull();
  });

  it('returns null for a linear chain (no cycle)', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'x' } },
      { fieldId: 'c', showWhen: { field: 'b', operator: 'equals', value: 'y' } },
    ];
    expect(detectCircularConditions(conditions)).toBeNull();
  });

  it('detects a direct self-cycle (A depends on A)', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'a', showWhen: { field: 'a', operator: 'equals', value: 'x' } },
    ];
    const cycle = detectCircularConditions(conditions);
    expect(cycle).not.toBeNull();
    expect(cycle!).toContain('a');
  });

  it('detects a two-node cycle (A depends on B, B depends on A)', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'a', showWhen: { field: 'b', operator: 'equals', value: 'x' } },
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'y' } },
    ];
    const cycle = detectCircularConditions(conditions);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(2);
  });

  it('detects a three-node cycle (A→B→C→A)', () => {
    const conditions: FieldCondition[] = [
      { fieldId: 'a', showWhen: { field: 'c', operator: 'equals', value: 'x' } },
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'y' } },
      { fieldId: 'c', showWhen: { field: 'b', operator: 'equals', value: 'z' } },
    ];
    const cycle = detectCircularConditions(conditions);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── parseConditions ─────────────────────────────────────────────────────────

describe('parseConditions', () => {
  it('parses a valid JSON array of conditions', () => {
    const json = JSON.stringify([
      { fieldId: 'b', showWhen: { field: 'a', operator: 'equals', value: 'yes' } },
    ]);
    const result = parseConditions(json);
    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe('b');
  });

  it('returns empty array for empty string', () => {
    expect(parseConditions('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseConditions('not-json')).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    expect(parseConditions('{"foo":"bar"}')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseConditions('   ')).toEqual([]);
  });
});
