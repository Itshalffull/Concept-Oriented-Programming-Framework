/**
 * Tests for UrlParamsProvider — URL query string ↔ FilterNode IR conversion.
 *
 * Covers parse, print, canPrint, and round-trip fidelity for all
 * supported FilterNode shapes.
 */

import { describe, it, expect } from 'vitest';
import { parse, print, canPrint } from '../../handlers/ts/view/providers/url-params-provider';
import type { FilterNode } from '../../handlers/ts/view/providers/url-params-provider';

// ── parse ─────────────────────────────────────────────────────────────────────

describe('parse', () => {
  it('empty string → true', () => {
    expect(parse('')).toEqual({ type: 'true' });
  });

  it('whitespace-only string → true', () => {
    expect(parse('   ')).toEqual({ type: 'true' });
  });

  it('single value → comparison eq', () => {
    expect(parse('status=open')).toEqual({
      type: 'eq',
      field: 'status',
      value: 'open',
    });
  });

  it('numeric single value → eq with number', () => {
    expect(parse('priority=3')).toEqual({
      type: 'eq',
      field: 'priority',
      value: 3,
    });
  });

  it('multiple comma-separated values → in node', () => {
    expect(parse('schemas=Concept,Sync')).toEqual({
      type: 'in',
      field: 'schemas',
      values: ['Concept', 'Sync'],
    });
  });

  it('three comma-separated values → in node with all values', () => {
    expect(parse('type=a,b,c')).toEqual({
      type: 'in',
      field: 'type',
      values: ['a', 'b', 'c'],
    });
  });

  it('multiple fields → and tree', () => {
    const result = parse('schemas=Concept,Sync&status=open&priority=high') as Extract<FilterNode, { type: 'and' }>;
    expect(result.type).toBe('and');
    expect(result.conditions).toHaveLength(3);
    expect(result.conditions[0]).toEqual({ type: 'in', field: 'schemas', values: ['Concept', 'Sync'] });
    expect(result.conditions[1]).toEqual({ type: 'eq', field: 'status', value: 'open' });
    expect(result.conditions[2]).toEqual({ type: 'eq', field: 'priority', value: 'high' });
  });

  it('two fields → and tree', () => {
    const result = parse('a=1&b=2') as Extract<FilterNode, { type: 'and' }>;
    expect(result.type).toBe('and');
    expect(result.conditions).toHaveLength(2);
  });

  describe('operator suffixes', () => {
    it('__gt suffix → gt comparison', () => {
      expect(parse('count__gt=5')).toEqual({ type: 'gt', field: 'count', value: 5 });
    });

    it('__gte suffix → gte comparison', () => {
      expect(parse('count__gte=5')).toEqual({ type: 'gte', field: 'count', value: 5 });
    });

    it('__lt suffix → lt comparison', () => {
      expect(parse('count__lt=10')).toEqual({ type: 'lt', field: 'count', value: 10 });
    });

    it('__lte suffix → lte comparison', () => {
      expect(parse('count__lte=10')).toEqual({ type: 'lte', field: 'count', value: 10 });
    });

    it('__neq suffix → neq comparison', () => {
      expect(parse('status__neq=closed')).toEqual({ type: 'neq', field: 'status', value: 'closed' });
    });

    it('__contains suffix → function node', () => {
      expect(parse('title__contains=hello')).toEqual({
        type: 'function',
        name: 'contains',
        field: 'title',
        value: 'hello',
      });
    });

    it('__startsWith suffix → function node', () => {
      expect(parse('slug__startsWith=clef-')).toEqual({
        type: 'function',
        name: 'startsWith',
        field: 'slug',
        value: 'clef-',
      });
    });
  });
});

// ── print ─────────────────────────────────────────────────────────────────────

describe('print', () => {
  it('true node → empty string', () => {
    expect(print({ type: 'true' })).toBe('');
  });

  it('false node → null (unsupported)', () => {
    expect(print({ type: 'false' })).toBeNull();
  });

  it('eq comparison → field=value', () => {
    expect(print({ type: 'eq', field: 'status', value: 'open' })).toBe('status=open');
  });

  it('eq comparison with number → field=value', () => {
    expect(print({ type: 'eq', field: 'priority', value: 3 })).toBe('priority=3');
  });

  it('neq comparison → field__neq=value', () => {
    expect(print({ type: 'neq', field: 'status', value: 'closed' })).toBe('status__neq=closed');
  });

  it('gt comparison → field__gt=value', () => {
    expect(print({ type: 'gt', field: 'count', value: 5 })).toBe('count__gt=5');
  });

  it('gte comparison → field__gte=value', () => {
    expect(print({ type: 'gte', field: 'count', value: 5 })).toBe('count__gte=5');
  });

  it('lt comparison → field__lt=value', () => {
    expect(print({ type: 'lt', field: 'count', value: 10 })).toBe('count__lt=10');
  });

  it('lte comparison → field__lte=value', () => {
    expect(print({ type: 'lte', field: 'count', value: 10 })).toBe('count__lte=10');
  });

  it('in node → field=val1,val2', () => {
    expect(print({ type: 'in', field: 'schemas', values: ['Concept', 'Sync'] })).toBe('schemas=Concept%2CSync'.replace('%2C', ','));
  });

  it('in node with single value → field=val', () => {
    expect(print({ type: 'in', field: 'type', values: ['article'] })).toBe('type=article');
  });

  it('in node with empty values → null', () => {
    expect(print({ type: 'in', field: 'type', values: [] })).toBeNull();
  });

  it('and node → join parts with &', () => {
    const node: FilterNode = {
      type: 'and',
      conditions: [
        { type: 'eq', field: 'status', value: 'open' },
        { type: 'eq', field: 'priority', value: 'high' },
      ],
    };
    expect(print(node)).toBe('status=open&priority=high');
  });

  it('and node containing true → omits true in output', () => {
    const node: FilterNode = {
      type: 'and',
      conditions: [
        { type: 'true' },
        { type: 'eq', field: 'status', value: 'open' },
      ],
    };
    expect(print(node)).toBe('status=open');
  });

  it('and node containing unsupported child → null', () => {
    const node: FilterNode = {
      type: 'and',
      conditions: [
        { type: 'eq', field: 'status', value: 'open' },
        { type: 'or', conditions: [{ type: 'eq', field: 'x', value: '1' }, { type: 'eq', field: 'y', value: '2' }] },
      ],
    };
    expect(print(node)).toBeNull();
  });

  it('or node → null (unsupported)', () => {
    const node: FilterNode = {
      type: 'or',
      conditions: [
        { type: 'eq', field: 'a', value: '1' },
        { type: 'eq', field: 'b', value: '2' },
      ],
    };
    expect(print(node)).toBeNull();
  });

  it('not node → null (unsupported)', () => {
    expect(print({ type: 'not', condition: { type: 'eq', field: 'a', value: '1' } })).toBeNull();
  });

  it('not_in node → null (unsupported)', () => {
    expect(print({ type: 'not_in', field: 'type', values: ['draft'] })).toBeNull();
  });

  it('exists node → null (unsupported)', () => {
    expect(print({ type: 'exists', field: 'author' })).toBeNull();
  });

  it('param node → null (unsupported)', () => {
    expect(print({ type: 'param', name: 'currentUser' })).toBeNull();
  });

  it('function node with contains → field__contains=value', () => {
    expect(print({ type: 'function', name: 'contains', field: 'title', value: 'hello' })).toBe('title__contains=hello');
  });

  it('function node with startsWith → field__startsWith=value', () => {
    expect(print({ type: 'function', name: 'startsWith', field: 'slug', value: 'clef-' })).toBe('slug__startsWith=clef-');
  });

  it('function node with endsWith → null (not representable)', () => {
    expect(print({ type: 'function', name: 'endsWith', field: 'slug', value: '.ts' })).toBeNull();
  });

  it('function node with matches (regex) → null (not representable)', () => {
    expect(print({ type: 'function', name: 'matches', field: 'name', value: '^[A-Z]' })).toBeNull();
  });
});

// ── canPrint ──────────────────────────────────────────────────────────────────

describe('canPrint', () => {
  it('true → true', () => {
    expect(canPrint({ type: 'true' })).toBe(true);
  });

  it('false → false', () => {
    expect(canPrint({ type: 'false' })).toBe(false);
  });

  it('eq comparison → true', () => {
    expect(canPrint({ type: 'eq', field: 'status', value: 'open' })).toBe(true);
  });

  it('in node → true', () => {
    expect(canPrint({ type: 'in', field: 'type', values: ['a', 'b'] })).toBe(true);
  });

  it('or node → false', () => {
    expect(canPrint({ type: 'or', conditions: [{ type: 'true' }] })).toBe(false);
  });

  it('not node → false', () => {
    expect(canPrint({ type: 'not', condition: { type: 'true' } })).toBe(false);
  });

  it('function/endsWith → false', () => {
    expect(canPrint({ type: 'function', name: 'endsWith', field: 'x', value: 'y' })).toBe(false);
  });
});

// ── round-trips ───────────────────────────────────────────────────────────────

describe('round-trip (parse → print → parse)', () => {
  function roundTrip(input: string): FilterNode {
    const node = parse(input);
    const printed = print(node);
    if (printed === null) throw new Error(`print returned null for: ${input}`);
    return parse(printed);
  }

  it('single value', () => {
    expect(roundTrip('status=open')).toEqual(parse('status=open'));
  });

  it('multi-value in', () => {
    expect(roundTrip('schemas=Concept,Sync')).toEqual(parse('schemas=Concept,Sync'));
  });

  it('multiple fields', () => {
    expect(roundTrip('status=open&priority=high')).toEqual(parse('status=open&priority=high'));
  });

  it('gt suffix', () => {
    expect(roundTrip('count__gt=5')).toEqual(parse('count__gt=5'));
  });

  it('contains suffix', () => {
    expect(roundTrip('title__contains=hello')).toEqual(parse('title__contains=hello'));
  });

  it('empty string', () => {
    expect(roundTrip('')).toEqual({ type: 'true' });
  });
});

describe('round-trip (node → print → parse)', () => {
  function nodeRoundTrip(node: FilterNode): FilterNode {
    const printed = print(node);
    if (printed === null) throw new Error('print returned null');
    return parse(printed);
  }

  it('true node survives round-trip', () => {
    expect(nodeRoundTrip({ type: 'true' })).toEqual({ type: 'true' });
  });

  it('eq node survives round-trip', () => {
    const node: FilterNode = { type: 'eq', field: 'status', value: 'open' };
    expect(nodeRoundTrip(node)).toEqual(node);
  });

  it('in node survives round-trip', () => {
    const node: FilterNode = { type: 'in', field: 'schemas', values: ['Concept', 'Sync'] };
    expect(nodeRoundTrip(node)).toEqual(node);
  });

  it('and node survives round-trip', () => {
    const node: FilterNode = {
      type: 'and',
      conditions: [
        { type: 'eq', field: 'status', value: 'open' },
        { type: 'in', field: 'type', values: ['article', 'note'] },
      ],
    };
    expect(nodeRoundTrip(node)).toEqual(node);
  });

  it('gt comparison survives round-trip', () => {
    const node: FilterNode = { type: 'gt', field: 'count', value: 5 };
    expect(nodeRoundTrip(node)).toEqual(node);
  });
});
