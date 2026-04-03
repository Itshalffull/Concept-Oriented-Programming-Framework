import { describe, expect, it } from 'vitest';
import {
  parse,
  print,
  canPrint,
  kind,
} from '../../handlers/ts/view/providers/text-dsl-provider.js';
import type { FilterNode } from '../../handlers/ts/view/providers/text-dsl-provider.js';

describe('TextDslProvider', () => {
  // ─── parse: comparison operators ────────────────────────────────────────────

  describe('parse: comparison operators', () => {
    it('eq with unquoted string value', () => {
      expect(parse('priority = high')).toEqual({
        type: 'eq', field: 'priority', value: 'high',
      });
    });

    it('eq with double-quoted string value', () => {
      expect(parse('status = "in-progress"')).toEqual({
        type: 'eq', field: 'status', value: 'in-progress',
      });
    });

    it('eq with numeric value coerced to number', () => {
      expect(parse('count = 42')).toEqual({
        type: 'eq', field: 'count', value: 42,
      });
    });

    it('neq operator', () => {
      expect(parse('status != closed')).toEqual({
        type: 'neq', field: 'status', value: 'closed',
      });
    });

    it('gt operator', () => {
      expect(parse('score > 5')).toEqual({
        type: 'gt', field: 'score', value: 5,
      });
    });

    it('gte operator', () => {
      expect(parse('score >= 5')).toEqual({
        type: 'gte', field: 'score', value: 5,
      });
    });

    it('lt operator', () => {
      expect(parse('priority < 3')).toEqual({
        type: 'lt', field: 'priority', value: 3,
      });
    });

    it('lte operator', () => {
      expect(parse('priority <= 3')).toEqual({
        type: 'lte', field: 'priority', value: 3,
      });
    });

    it('eq with float value', () => {
      expect(parse('ratio = 1.5')).toEqual({
        type: 'eq', field: 'ratio', value: 1.5,
      });
    });
  });

  // ─── parse: IN lists ─────────────────────────────────────────────────────────

  describe('parse: IN lists', () => {
    it('single value in list', () => {
      expect(parse('status in (open)')).toEqual({
        type: 'in', field: 'status', values: ['open'],
      });
    });

    it('multiple unquoted values', () => {
      expect(parse('status in (open, closed, pending)')).toEqual({
        type: 'in',
        field: 'status',
        values: ['open', 'closed', 'pending'],
      });
    });

    it('mixed quoted and unquoted values', () => {
      expect(parse('status in (open, "in-progress", closed)')).toEqual({
        type: 'in',
        field: 'status',
        values: ['open', 'in-progress', 'closed'],
      });
    });

    it('numeric values in list', () => {
      expect(parse('priority in (1, 2, 3)')).toEqual({
        type: 'in',
        field: 'priority',
        values: [1, 2, 3],
      });
    });

    it('empty list', () => {
      expect(parse('status in ()')).toEqual({
        type: 'in', field: 'status', values: [],
      });
    });
  });

  // ─── parse: function calls ───────────────────────────────────────────────────

  describe('parse: function calls', () => {
    it('contains with quoted argument', () => {
      expect(parse('name contains "test"')).toEqual({
        type: 'function', name: 'contains', field: 'name', value: 'test',
      });
    });

    it('contains with unquoted argument', () => {
      expect(parse('tag contains alpha')).toEqual({
        type: 'function', name: 'contains', field: 'tag', value: 'alpha',
      });
    });

    it('startsWith', () => {
      expect(parse('name startsWith "foo"')).toEqual({
        type: 'function', name: 'startsWith', field: 'name', value: 'foo',
      });
    });

    it('endsWith', () => {
      expect(parse('path endsWith ".ts"')).toEqual({
        type: 'function', name: 'endsWith', field: 'path', value: '.ts',
      });
    });
  });

  // ─── parse: exists ───────────────────────────────────────────────────────────

  describe('parse: exists', () => {
    it('field exists', () => {
      expect(parse('archived exists')).toEqual({
        type: 'exists', field: 'archived',
      });
    });
  });

  // ─── parse: boolean AND / OR / NOT ──────────────────────────────────────────

  describe('parse: boolean operators', () => {
    it('AND of two comparisons', () => {
      expect(parse('priority = high AND status = open')).toEqual({
        type: 'and',
        conditions: [
          { type: 'eq', field: 'priority', value: 'high' },
          { type: 'eq', field: 'status', value: 'open' },
        ],
      });
    });

    it('OR of two comparisons', () => {
      expect(parse('status = open OR status = pending')).toEqual({
        type: 'or',
        conditions: [
          { type: 'eq', field: 'status', value: 'open' },
          { type: 'eq', field: 'status', value: 'pending' },
        ],
      });
    });

    it('NOT of a bare field name (sugar for NOT field exists)', () => {
      expect(parse('NOT archived')).toEqual({
        type: 'not',
        condition: { type: 'exists', field: 'archived' },
      });
    });

    it('NOT field exists (explicit)', () => {
      expect(parse('NOT archived exists')).toEqual({
        type: 'not',
        condition: { type: 'exists', field: 'archived' },
      });
    });

    it('NOT of a comparison', () => {
      expect(parse('NOT status = closed')).toEqual({
        type: 'not',
        condition: { type: 'eq', field: 'status', value: 'closed' },
      });
    });

    it('AND chains three conditions', () => {
      const result = parse('a = 1 AND b = 2 AND c = 3');
      // Left-associative grouping via flattened and-node
      expect(result.type).toBe('and');
      const andNode = result as Extract<FilterNode, { type: 'and' }>;
      expect(andNode.conditions).toHaveLength(3);
      expect(andNode.conditions[0]).toEqual({ type: 'eq', field: 'a', value: 1 });
      expect(andNode.conditions[1]).toEqual({ type: 'eq', field: 'b', value: 2 });
      expect(andNode.conditions[2]).toEqual({ type: 'eq', field: 'c', value: 3 });
    });

    it('AND has higher precedence than OR', () => {
      // a = 1 OR b = 2 AND c = 3  →  a = 1 OR (b = 2 AND c = 3)
      const result = parse('a = 1 OR b = 2 AND c = 3');
      expect(result.type).toBe('or');
      const orNode = result as Extract<FilterNode, { type: 'or' }>;
      expect(orNode.conditions[0]).toEqual({ type: 'eq', field: 'a', value: 1 });
      expect(orNode.conditions[1]).toEqual({
        type: 'and',
        conditions: [
          { type: 'eq', field: 'b', value: 2 },
          { type: 'eq', field: 'c', value: 3 },
        ],
      });
    });

    it('empty string → true node', () => {
      expect(parse('')).toEqual({ type: 'true' });
      expect(parse('   ')).toEqual({ type: 'true' });
    });
  });

  // ─── parse: parenthesized grouping ──────────────────────────────────────────

  describe('parse: parenthesized grouping', () => {
    it('grouped OR inside AND', () => {
      const result = parse('(a = 1 OR b = 2) AND c = 3');
      expect(result).toEqual({
        type: 'and',
        conditions: [
          {
            type: 'or',
            conditions: [
              { type: 'eq', field: 'a', value: 1 },
              { type: 'eq', field: 'b', value: 2 },
            ],
          },
          { type: 'eq', field: 'c', value: 3 },
        ],
      });
    });

    it('grouped AND inside OR', () => {
      const result = parse('a = 1 OR (b = 2 AND c = 3)');
      expect(result).toEqual({
        type: 'or',
        conditions: [
          { type: 'eq', field: 'a', value: 1 },
          {
            type: 'and',
            conditions: [
              { type: 'eq', field: 'b', value: 2 },
              { type: 'eq', field: 'c', value: 3 },
            ],
          },
        ],
      });
    });

    it('parens around single expression', () => {
      expect(parse('(priority = high)')).toEqual({
        type: 'eq', field: 'priority', value: 'high',
      });
    });

    it('NOT with parenthesized group', () => {
      expect(parse('NOT (a = 1 OR b = 2)')).toEqual({
        type: 'not',
        condition: {
          type: 'or',
          conditions: [
            { type: 'eq', field: 'a', value: 1 },
            { type: 'eq', field: 'b', value: 2 },
          ],
        },
      });
    });
  });

  // ─── parse: nested expressions ───────────────────────────────────────────────

  describe('parse: nested expressions', () => {
    it('deeply nested grouping', () => {
      const result = parse('(a = 1 AND (b = 2 OR c = 3)) AND d = 4');
      expect(result).toEqual({
        type: 'and',
        conditions: [
          {
            type: 'and',
            conditions: [
              { type: 'eq', field: 'a', value: 1 },
              {
                type: 'or',
                conditions: [
                  { type: 'eq', field: 'b', value: 2 },
                  { type: 'eq', field: 'c', value: 3 },
                ],
              },
            ],
          },
          { type: 'eq', field: 'd', value: 4 },
        ],
      });
    });

    it('NOT of NOT', () => {
      expect(parse('NOT NOT active exists')).toEqual({
        type: 'not',
        condition: {
          type: 'not',
          condition: { type: 'exists', field: 'active' },
        },
      });
    });

    it('complex mixed expression', () => {
      const result = parse('status in (open, pending) AND NOT archived exists AND score >= 5');
      expect(result.type).toBe('and');
      const andNode = result as Extract<FilterNode, { type: 'and' }>;
      expect(andNode.conditions).toHaveLength(3);
      expect(andNode.conditions[0]).toEqual({ type: 'in', field: 'status', values: ['open', 'pending'] });
      expect(andNode.conditions[1]).toEqual({ type: 'not', condition: { type: 'exists', field: 'archived' } });
      expect(andNode.conditions[2]).toEqual({ type: 'gte', field: 'score', value: 5 });
    });
  });

  // ─── parse: error cases ──────────────────────────────────────────────────────

  describe('parse: error cases', () => {
    it('throws on unterminated string', () => {
      expect(() => parse('name = "unterminated')).toThrow(SyntaxError);
    });

    it('throws on unexpected character', () => {
      expect(() => parse('name @ value')).toThrow(SyntaxError);
    });

    it('throws on missing closing paren', () => {
      expect(() => parse('(a = 1 AND b = 2')).toThrow(SyntaxError);
    });

    it('throws on missing operator after field', () => {
      expect(() => parse('name value')).toThrow(SyntaxError);
    });
  });

  // ─── print ────────────────────────────────────────────────────────────────────

  describe('print', () => {
    it('true node → "true"', () => {
      expect(print({ type: 'true' })).toBe('true');
    });

    it('false node → "false"', () => {
      expect(print({ type: 'false' })).toBe('false');
    });

    it('eq with string value', () => {
      expect(print({ type: 'eq', field: 'status', value: 'open' })).toBe('status = open');
    });

    it('eq with numeric value', () => {
      expect(print({ type: 'eq', field: 'count', value: 42 })).toBe('count = 42');
    });

    it('eq with value that looks numeric (quotes it)', () => {
      // "42" as a string would need quoting to survive round-trip as string
      // But since we coerce numbers on parse, this tests the printer's quoting behavior
      expect(print({ type: 'eq', field: 'code', value: '42' })).toBe('code = "42"');
    });

    it('neq operator', () => {
      expect(print({ type: 'neq', field: 'status', value: 'archived' })).toBe('status != archived');
    });

    it('gt operator', () => {
      expect(print({ type: 'gt', field: 'score', value: 5 })).toBe('score > 5');
    });

    it('gte operator', () => {
      expect(print({ type: 'gte', field: 'score', value: 5 })).toBe('score >= 5');
    });

    it('lt operator', () => {
      expect(print({ type: 'lt', field: 'priority', value: 3 })).toBe('priority < 3');
    });

    it('lte operator', () => {
      expect(print({ type: 'lte', field: 'priority', value: 3 })).toBe('priority <= 3');
    });

    it('in node', () => {
      expect(print({ type: 'in', field: 'status', values: ['open', 'closed'] }))
        .toBe('status in (open, closed)');
    });

    it('in node with quoted value containing hyphen', () => {
      expect(print({ type: 'in', field: 'status', values: ['open', 'in-progress'] }))
        .toBe('status in (open, "in-progress")');
    });

    it('not_in node prints as NOT ... in (...)', () => {
      expect(print({ type: 'not_in', field: 'status', values: ['archived'] }))
        .toBe('NOT status in (archived)');
    });

    it('exists node', () => {
      expect(print({ type: 'exists', field: 'archived' })).toBe('archived exists');
    });

    it('function: contains (always quoted)', () => {
      expect(print({ type: 'function', name: 'contains', field: 'name', value: 'test' }))
        .toBe('name contains "test"');
    });

    it('function: startsWith (always quoted)', () => {
      expect(print({ type: 'function', name: 'startsWith', field: 'path', value: '/src' }))
        .toBe('path startsWith "/src"');
    });

    it('function: endsWith (always quoted)', () => {
      expect(print({ type: 'function', name: 'endsWith', field: 'file', value: '.ts' }))
        .toBe('file endsWith ".ts"');
    });

    it('and node', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'a', value: 1 },
          { type: 'eq', field: 'b', value: 2 },
        ],
      };
      expect(print(node)).toBe('a = 1 AND b = 2');
    });

    it('or node', () => {
      const node: FilterNode = {
        type: 'or',
        conditions: [
          { type: 'eq', field: 'a', value: 1 },
          { type: 'eq', field: 'b', value: 2 },
        ],
      };
      expect(print(node)).toBe('a = 1 OR b = 2');
    });

    it('not node', () => {
      expect(print({ type: 'not', condition: { type: 'exists', field: 'archived' } }))
        .toBe('NOT archived exists');
    });

    it('and with or child wraps or in parens', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'or', conditions: [{ type: 'eq', field: 'a', value: 1 }, { type: 'eq', field: 'b', value: 2 }] },
          { type: 'eq', field: 'c', value: 3 },
        ],
      };
      expect(print(node)).toBe('(a = 1 OR b = 2) AND c = 3');
    });

    it('param node → null (no DSL representation)', () => {
      expect(print({ type: 'param', name: 'myVar' })).toBeNull();
    });
  });

  // ─── canPrint ─────────────────────────────────────────────────────────────────

  describe('canPrint', () => {
    it('true → true', () => expect(canPrint({ type: 'true' })).toBe(true));
    it('false → true', () => expect(canPrint({ type: 'false' })).toBe(true));
    it('eq → true', () => expect(canPrint({ type: 'eq', field: 'a', value: 1 })).toBe(true));
    it('neq → true', () => expect(canPrint({ type: 'neq', field: 'a', value: 1 })).toBe(true));
    it('gt → true', () => expect(canPrint({ type: 'gt', field: 'a', value: 1 })).toBe(true));
    it('gte → true', () => expect(canPrint({ type: 'gte', field: 'a', value: 1 })).toBe(true));
    it('lt → true', () => expect(canPrint({ type: 'lt', field: 'a', value: 1 })).toBe(true));
    it('lte → true', () => expect(canPrint({ type: 'lte', field: 'a', value: 1 })).toBe(true));
    it('in → true', () => expect(canPrint({ type: 'in', field: 'a', values: ['x'] })).toBe(true));
    it('not_in → true', () => expect(canPrint({ type: 'not_in', field: 'a', values: ['x'] })).toBe(true));
    it('exists → true', () => expect(canPrint({ type: 'exists', field: 'a' })).toBe(true));
    it('function → true', () => expect(canPrint({ type: 'function', name: 'contains', field: 'a', value: 'x' })).toBe(true));
    it('and → true', () => expect(canPrint({ type: 'and', conditions: [{ type: 'eq', field: 'a', value: 1 }] })).toBe(true));
    it('or → true', () => expect(canPrint({ type: 'or', conditions: [{ type: 'eq', field: 'a', value: 1 }] })).toBe(true));
    it('not → true', () => expect(canPrint({ type: 'not', condition: { type: 'exists', field: 'a' } })).toBe(true));
    it('param → false (no DSL representation)', () => expect(canPrint({ type: 'param', name: 'x' })).toBe(false));
  });

  // ─── round-trip: parse(print(node)) equals original ─────────────────────────

  describe('round-trip: parse(print(node)) equals original node', () => {
    function roundTripNode(node: FilterNode): FilterNode {
      const printed = print(node);
      if (printed === null) throw new Error(`print returned null for ${JSON.stringify(node)}`);
      return parse(printed);
    }

    it('true node', () => {
      expect(roundTripNode({ type: 'true' })).toEqual({ type: 'true' });
    });

    it('false node', () => {
      expect(roundTripNode({ type: 'false' })).toEqual({ type: 'false' });
    });

    it('eq with string value', () => {
      const node: FilterNode = { type: 'eq', field: 'status', value: 'open' };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('eq with numeric value', () => {
      const node: FilterNode = { type: 'eq', field: 'count', value: 42 };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('neq node', () => {
      const node: FilterNode = { type: 'neq', field: 'status', value: 'closed' };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('gt node', () => {
      const node: FilterNode = { type: 'gt', field: 'score', value: 5 };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('gte node', () => {
      const node: FilterNode = { type: 'gte', field: 'score', value: 5 };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('lt node', () => {
      const node: FilterNode = { type: 'lt', field: 'priority', value: 3 };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('lte node', () => {
      const node: FilterNode = { type: 'lte', field: 'priority', value: 3 };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('in node with string values', () => {
      const node: FilterNode = { type: 'in', field: 'status', values: ['open', 'closed'] };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('in node with numeric values', () => {
      const node: FilterNode = { type: 'in', field: 'priority', values: [1, 2, 3] };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('exists node', () => {
      const node: FilterNode = { type: 'exists', field: 'archived' };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('function: contains', () => {
      const node: FilterNode = { type: 'function', name: 'contains', field: 'name', value: 'test' };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('function: startsWith', () => {
      const node: FilterNode = { type: 'function', name: 'startsWith', field: 'path', value: 'src' };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('function: endsWith', () => {
      const node: FilterNode = { type: 'function', name: 'endsWith', field: 'file', value: '.ts' };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('and node', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'a', value: 'x' },
          { type: 'eq', field: 'b', value: 'y' },
        ],
      };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('or node', () => {
      const node: FilterNode = {
        type: 'or',
        conditions: [
          { type: 'eq', field: 'a', value: 'x' },
          { type: 'eq', field: 'b', value: 'y' },
        ],
      };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('not node', () => {
      const node: FilterNode = {
        type: 'not',
        condition: { type: 'exists', field: 'archived' },
      };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('not-of-comparison', () => {
      const node: FilterNode = {
        type: 'not',
        condition: { type: 'eq', field: 'status', value: 'closed' },
      };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('nested: and containing or', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          {
            type: 'or',
            conditions: [
              { type: 'eq', field: 'a', value: 1 },
              { type: 'eq', field: 'b', value: 2 },
            ],
          },
          { type: 'eq', field: 'c', value: 3 },
        ],
      };
      expect(roundTripNode(node)).toEqual(node);
    });

    it('complex mixed tree', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'in', field: 'status', values: ['open', 'pending'] },
          { type: 'not', condition: { type: 'exists', field: 'archived' } },
          { type: 'gte', field: 'score', value: 5 },
        ],
      };
      expect(roundTripNode(node)).toEqual(node);
    });
  });

  // ─── round-trip: print(parse(text)) == normalized text ────────────────────

  describe('round-trip: print(parse(text)) equals normalized text', () => {
    function roundTripText(text: string): string {
      const node = parse(text);
      const printed = print(node);
      if (printed === null) throw new Error(`print returned null for parsed "${text}"`);
      return printed;
    }

    it('simple comparison normalizes whitespace', () => {
      expect(roundTripText('priority=high')).toBe('priority = high');
    });

    it('quoted value with no special chars may normalize to unquoted', () => {
      // "open" is a plain identifier — prints without quotes
      expect(roundTripText('status = "open"')).toBe('status = open');
    });

    it('quoted value with hyphen stays quoted', () => {
      expect(roundTripText('status = "in-progress"')).toBe('status = "in-progress"');
    });

    it('AND expression normalizes', () => {
      expect(roundTripText('a = 1 AND b = 2')).toBe('a = 1 AND b = 2');
    });

    it('OR expression normalizes', () => {
      expect(roundTripText('a = 1 OR b = 2')).toBe('a = 1 OR b = 2');
    });

    it('NOT expression normalizes', () => {
      expect(roundTripText('NOT archived exists')).toBe('NOT archived exists');
    });

    it('IN list normalizes spacing', () => {
      expect(roundTripText('status in (open,closed)')).toBe('status in (open, closed)');
    });

    it('parenthesized group with AND-inside-OR retains parens', () => {
      // a = 1 OR b = 2 AND c = 3 parses as OR(a=1, AND(b=2, c=3))
      // print will wrap AND children of OR in parens? No — OR prints a=1 and (b=2 AND c=3)
      const text = 'a = 1 OR b = 2 AND c = 3';
      const node = parse(text);
      expect(node.type).toBe('or');
      // The printer wraps AND inside OR with parens only for AND children of OR
      // (see print() — it wraps 'and' children of 'or')
      const printed = print(node)!;
      // re-parse the printed form and verify it produces the same tree
      expect(parse(printed)).toEqual(node);
    });
  });

  // ─── kind ─────────────────────────────────────────────────────────────────────

  it('exports kind = "text-dsl"', () => {
    expect(kind).toBe('text-dsl');
  });
});
