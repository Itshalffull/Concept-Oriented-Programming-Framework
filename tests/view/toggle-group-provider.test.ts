import { describe, expect, it } from 'vitest';
import {
  parse,
  print,
  canPrint,
  kind,
} from '../../handlers/ts/view/providers/toggle-group-provider.js';
import type { FilterNode } from '../../handlers/ts/view/providers/toggle-group-provider.js';

describe('ToggleGroupProvider', () => {
  // ─── parse ───────────────────────────────────────────────────────────────

  describe('parse', () => {
    it('empty object → true node', () => {
      const result = parse('{}');
      expect(result).toEqual({ type: 'true' });
    });

    it('single field with values → in node', () => {
      const result = parse('{"schemas":["Concept","Sync"]}');
      expect(result).toEqual({
        type: 'in',
        field: 'schemas',
        values: ['Concept', 'Sync'],
      });
    });

    it('multiple fields → and node containing in nodes', () => {
      const result = parse('{"schemas":["Concept","Sync"],"status":["open"]}');
      expect(result).toEqual({
        type: 'and',
        conditions: [
          { type: 'in', field: 'schemas', values: ['Concept', 'Sync'] },
          { type: 'in', field: 'status', values: ['open'] },
        ],
      });
    });

    it('field with empty values array is ignored', () => {
      const result = parse('{"schemas":[],"status":["open"]}');
      expect(result).toEqual({
        type: 'in',
        field: 'status',
        values: ['open'],
      });
    });

    it('all fields empty → true node', () => {
      const result = parse('{"schemas":[],"status":[]}');
      expect(result).toEqual({ type: 'true' });
    });

    it('throws SyntaxError on invalid JSON', () => {
      expect(() => parse('not-json')).toThrow(SyntaxError);
    });
  });

  // ─── print ───────────────────────────────────────────────────────────────

  describe('print', () => {
    it('true node → empty object string', () => {
      const result = print({ type: 'true' });
      expect(result).toBe('{}');
    });

    it('in node → single-field object string', () => {
      const node: FilterNode = { type: 'in', field: 'schemas', values: ['Concept', 'Sync'] };
      const result = print(node);
      expect(JSON.parse(result!)).toEqual({ schemas: ['Concept', 'Sync'] });
    });

    it('and-of-in nodes → multi-field object string', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'in', field: 'schemas', values: ['Concept'] },
          { type: 'in', field: 'status', values: ['open', 'closed'] },
        ],
      };
      const result = print(node);
      expect(JSON.parse(result!)).toEqual({
        schemas: ['Concept'],
        status: ['open', 'closed'],
      });
    });

    it('or node → null (unsupported)', () => {
      const node: FilterNode = {
        type: 'or',
        conditions: [
          { type: 'in', field: 'status', values: ['open'] },
          { type: 'in', field: 'status', values: ['closed'] },
        ],
      };
      expect(print(node)).toBeNull();
    });

    it('not node → null (unsupported)', () => {
      const node: FilterNode = {
        type: 'not',
        condition: { type: 'in', field: 'status', values: ['archived'] },
      };
      expect(print(node)).toBeNull();
    });

    it('eq node → null (unsupported)', () => {
      const node: FilterNode = { type: 'eq', field: 'name', value: 'Alice' };
      expect(print(node)).toBeNull();
    });

    it('function node → null (unsupported)', () => {
      const node: FilterNode = { type: 'function', name: 'contains', field: 'name', value: 'ali' };
      expect(print(node)).toBeNull();
    });

    it('and containing non-in condition → null', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'in', field: 'schemas', values: ['Concept'] },
          { type: 'eq', field: 'status', value: 'open' },
        ],
      };
      expect(print(node)).toBeNull();
    });

    it('false node → null (unsupported)', () => {
      const node: FilterNode = { type: 'false' };
      expect(print(node)).toBeNull();
    });
  });

  // ─── canPrint ─────────────────────────────────────────────────────────────

  describe('canPrint', () => {
    it('true node → true', () => {
      expect(canPrint({ type: 'true' })).toBe(true);
    });

    it('in node → true', () => {
      expect(canPrint({ type: 'in', field: 'x', values: ['a'] })).toBe(true);
    });

    it('and-of-in nodes → true', () => {
      expect(canPrint({
        type: 'and',
        conditions: [
          { type: 'in', field: 'a', values: ['1'] },
          { type: 'in', field: 'b', values: ['2'] },
        ],
      })).toBe(true);
    });

    it('and containing non-in → false', () => {
      expect(canPrint({
        type: 'and',
        conditions: [
          { type: 'in', field: 'a', values: ['1'] },
          { type: 'eq', field: 'b', value: '2' },
        ],
      })).toBe(false);
    });

    it('or node → false', () => {
      expect(canPrint({
        type: 'or',
        conditions: [{ type: 'in', field: 'a', values: ['1'] }],
      })).toBe(false);
    });

    it('false node → false', () => {
      expect(canPrint({ type: 'false' })).toBe(false);
    });

    it('function node → false', () => {
      expect(canPrint({ type: 'function', name: 'contains', field: 'x', value: 'y' })).toBe(false);
    });
  });

  // ─── round-trip ───────────────────────────────────────────────────────────

  describe('round-trip: parse(print(node)) equals normalized node', () => {
    it('true node round-trips', () => {
      const node: FilterNode = { type: 'true' };
      const printed = print(node)!;
      const reparsed = parse(printed);
      expect(reparsed).toEqual(node);
    });

    it('single in node round-trips', () => {
      const node: FilterNode = { type: 'in', field: 'schemas', values: ['Concept', 'Sync'] };
      const printed = print(node)!;
      const reparsed = parse(printed);
      expect(reparsed).toEqual(node);
    });

    it('and-of-in nodes round-trips', () => {
      const node: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'in', field: 'schemas', values: ['Concept'] },
          { type: 'in', field: 'status', values: ['open'] },
        ],
      };
      const printed = print(node)!;
      const reparsed = parse(printed);
      // The round-tripped result preserves the AND structure with the same fields
      expect(reparsed).toEqual(node);
    });

    it('print returns null for unsupported nodes, parse is not called', () => {
      const node: FilterNode = { type: 'not_in', field: 'status', values: ['archived'] };
      const printed = print(node);
      expect(printed).toBeNull();
    });
  });

  // ─── kind ─────────────────────────────────────────────────────────────────

  it('exports kind = "toggle-group"', () => {
    expect(kind).toBe('toggle-group');
  });
});
