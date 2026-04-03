/**
 * Tests for ContextualProvider — context-parameterized FilterNode resolution.
 *
 * Covers parse (param substitution, unresolved fallback, passthrough),
 * canPrint (always false), and print (always null).
 */

import { describe, it, expect } from 'vitest';
import { parse, print, canPrint, kind } from '../../handlers/ts/view/providers/contextual-provider';
import type { FilterNode } from '../../handlers/ts/view/providers/contextual-provider';

// ── helpers ───────────────────────────────────────────────────────────────────

function repr(template: FilterNode, bindings: Record<string, unknown> = {}): string {
  return JSON.stringify({ template, bindings });
}

// ── parse ─────────────────────────────────────────────────────────────────────

describe('parse', () => {
  describe('resolves single param', () => {
    it('substitutes bound param value in eq comparison', () => {
      const template: FilterNode = {
        type: 'eq',
        field: 'entity_id',
        value: { type: 'param', name: 'entityId' },
      };
      const result = parse(repr(template, { entityId: 'abc123' }));
      expect(result).toEqual({ type: 'eq', field: 'entity_id', value: 'abc123' });
    });

    it('substitutes string param in neq comparison', () => {
      const template: FilterNode = { type: 'neq', field: 'status', value: { type: 'param', name: 'excludedStatus' } };
      const result = parse(repr(template, { excludedStatus: 'archived' }));
      expect(result).toEqual({ type: 'neq', field: 'status', value: 'archived' });
    });

    it('substitutes numeric param', () => {
      const template: FilterNode = { type: 'gt', field: 'priority', value: { type: 'param', name: 'minPriority' } };
      const result = parse(repr(template, { minPriority: 3 }));
      expect(result).toEqual({ type: 'gt', field: 'priority', value: 3 });
    });

    it('substitutes boolean param', () => {
      const template: FilterNode = { type: 'eq', field: 'active', value: { type: 'param', name: 'isActive' } };
      const result = parse(repr(template, { isActive: true }));
      expect(result).toEqual({ type: 'eq', field: 'active', value: true });
    });

    it('substitutes param into in node values array', () => {
      const template: FilterNode = {
        type: 'in',
        field: 'type',
        values: [{ type: 'param', name: 'entityType' }, 'fallback'],
      };
      const result = parse(repr(template, { entityType: 'concept' }));
      expect(result).toEqual({ type: 'in', field: 'type', values: ['concept', 'fallback'] });
    });

    it('substitutes param into not_in node values array', () => {
      const template: FilterNode = {
        type: 'not_in',
        field: 'status',
        values: [{ type: 'param', name: 'blockedStatus' }],
      };
      const result = parse(repr(template, { blockedStatus: 'deleted' }));
      expect(result).toEqual({ type: 'not_in', field: 'status', values: ['deleted'] });
    });

    it('substitutes param into function node value', () => {
      const template: FilterNode = {
        type: 'function',
        name: 'contains',
        field: 'title',
        value: { type: 'param', name: 'searchTerm' } as unknown as string,
      };
      const result = parse(repr(template, { searchTerm: 'hello' }));
      expect(result).toEqual({ type: 'function', name: 'contains', field: 'title', value: 'hello' });
    });
  });

  describe('resolves multiple params in AND tree', () => {
    it('substitutes all params in nested AND', () => {
      const template: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'owner', value: { type: 'param', name: 'userId' } },
          { type: 'eq', field: 'project', value: { type: 'param', name: 'projectId' } },
        ],
      };
      const result = parse(repr(template, { userId: 'user-1', projectId: 'proj-42' })) as Extract<FilterNode, { type: 'and' }>;
      expect(result.type).toBe('and');
      expect(result.conditions[0]).toEqual({ type: 'eq', field: 'owner', value: 'user-1' });
      expect(result.conditions[1]).toEqual({ type: 'eq', field: 'project', value: 'proj-42' });
    });

    it('substitutes params in deeply nested OR within AND', () => {
      const template: FilterNode = {
        type: 'and',
        conditions: [
          {
            type: 'or',
            conditions: [
              { type: 'eq', field: 'type', value: { type: 'param', name: 'typeA' } },
              { type: 'eq', field: 'type', value: { type: 'param', name: 'typeB' } },
            ],
          },
          { type: 'eq', field: 'owner', value: { type: 'param', name: 'userId' } },
        ],
      };
      const result = parse(repr(template, { typeA: 'concept', typeB: 'sync', userId: 'u-99' })) as Extract<FilterNode, { type: 'and' }>;
      expect(result.type).toBe('and');
      const orNode = result.conditions[0] as Extract<FilterNode, { type: 'or' }>;
      expect(orNode.type).toBe('or');
      expect(orNode.conditions[0]).toEqual({ type: 'eq', field: 'type', value: 'concept' });
      expect(orNode.conditions[1]).toEqual({ type: 'eq', field: 'type', value: 'sync' });
      expect(result.conditions[1]).toEqual({ type: 'eq', field: 'owner', value: 'u-99' });
    });

    it('substitutes params inside NOT node', () => {
      const template: FilterNode = {
        type: 'not',
        condition: { type: 'eq', field: 'status', value: { type: 'param', name: 'excludedStatus' } },
      };
      const result = parse(repr(template, { excludedStatus: 'deleted' })) as Extract<FilterNode, { type: 'not' }>;
      expect(result.type).toBe('not');
      expect(result.condition).toEqual({ type: 'eq', field: 'status', value: 'deleted' });
    });

    it('substitutes some params and leaves literal values unchanged', () => {
      const template: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'status', value: 'active' },
          { type: 'eq', field: 'owner', value: { type: 'param', name: 'userId' } },
        ],
      };
      const result = parse(repr(template, { userId: 'user-7' })) as Extract<FilterNode, { type: 'and' }>;
      expect(result.conditions[0]).toEqual({ type: 'eq', field: 'status', value: 'active' });
      expect(result.conditions[1]).toEqual({ type: 'eq', field: 'owner', value: 'user-7' });
    });
  });

  describe('handles unresolved params (fallback to true)', () => {
    it('unresolved param value in comparison → keeps param object (evaluateFilterNode treats param as true)', () => {
      const template: FilterNode = {
        type: 'eq',
        field: 'entity_id',
        value: { type: 'param', name: 'entityId' },
      };
      // No bindings provided — param is unresolved
      const result = parse(repr(template, {}));
      // Value remains as the param object; evaluateFilterNode handles it as true
      expect(result).toEqual({ type: 'eq', field: 'entity_id', value: { type: 'param', name: 'entityId' } });
    });

    it('standalone param node in AND → replaced with true', () => {
      const template: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'status', value: 'active' },
          { type: 'param', name: 'missingParam' },
        ],
      };
      const result = parse(repr(template, {})) as Extract<FilterNode, { type: 'and' }>;
      expect(result.type).toBe('and');
      expect(result.conditions[1]).toEqual({ type: 'true' });
    });

    it('empty bindings object — no params resolved in AND tree', () => {
      const template: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'owner', value: { type: 'param', name: 'userId' } },
          { type: 'eq', field: 'project', value: { type: 'param', name: 'projectId' } },
        ],
      };
      const result = parse(repr(template, {})) as Extract<FilterNode, { type: 'and' }>;
      // Unresolved param values are preserved for evaluateFilterNode's param handling
      expect(result.type).toBe('and');
      expect((result.conditions[0] as Extract<FilterNode, { type: 'eq' }>).value).toEqual({ type: 'param', name: 'userId' });
      expect((result.conditions[1] as Extract<FilterNode, { type: 'eq' }>).value).toEqual({ type: 'param', name: 'projectId' });
    });

    it('extra bindings that are not used — ignored silently', () => {
      const template: FilterNode = { type: 'eq', field: 'type', value: 'concept' };
      const result = parse(repr(template, { unused: 'value', alsoUnused: 42 }));
      expect(result).toEqual({ type: 'eq', field: 'type', value: 'concept' });
    });
  });

  describe('handles no params (passthrough)', () => {
    it('eq node with literal value passes through unchanged', () => {
      const template: FilterNode = { type: 'eq', field: 'type', value: 'concept' };
      const result = parse(repr(template, {}));
      expect(result).toEqual(template);
    });

    it('true node passes through unchanged', () => {
      const result = parse(repr({ type: 'true' }, {}));
      expect(result).toEqual({ type: 'true' });
    });

    it('false node passes through unchanged', () => {
      const result = parse(repr({ type: 'false' }, {}));
      expect(result).toEqual({ type: 'false' });
    });

    it('exists node passes through unchanged', () => {
      const template: FilterNode = { type: 'exists', field: 'author' };
      const result = parse(repr(template, {}));
      expect(result).toEqual(template);
    });

    it('complex literal AND tree passes through unchanged', () => {
      const template: FilterNode = {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'status', value: 'active' },
          { type: 'in', field: 'type', values: ['concept', 'sync'] },
        ],
      };
      const result = parse(repr(template, {}));
      expect(result).toEqual(template);
    });

    it('in node with literal values passes through unchanged', () => {
      const template: FilterNode = { type: 'in', field: 'schemas', values: ['Concept', 'Sync'] };
      const result = parse(repr(template, {}));
      expect(result).toEqual(template);
    });
  });

  describe('handles invalid input gracefully', () => {
    it('invalid JSON → true (permissive fallback)', () => {
      expect(parse('not-json')).toEqual({ type: 'true' });
    });

    it('empty string → true', () => {
      expect(parse('')).toEqual({ type: 'true' });
    });

    it('null JSON → true', () => {
      expect(parse('null')).toEqual({ type: 'true' });
    });

    it('missing template field → true', () => {
      expect(parse(JSON.stringify({ bindings: { x: 1 } }))).toEqual({ type: 'true' });
    });

    it('null template → true', () => {
      expect(parse(JSON.stringify({ template: null, bindings: {} }))).toEqual({ type: 'true' });
    });

    it('missing bindings field → treats as empty bindings (params unresolved)', () => {
      const template: FilterNode = { type: 'eq', field: 'type', value: 'concept' };
      const result = parse(JSON.stringify({ template }));
      expect(result).toEqual(template);
    });
  });
});

// ── canPrint ──────────────────────────────────────────────────────────────────

describe('canPrint', () => {
  it('always returns false for true node', () => {
    expect(canPrint({ type: 'true' })).toBe(false);
  });

  it('always returns false for false node', () => {
    expect(canPrint({ type: 'false' })).toBe(false);
  });

  it('always returns false for eq node', () => {
    expect(canPrint({ type: 'eq', field: 'status', value: 'active' })).toBe(false);
  });

  it('always returns false for and node', () => {
    expect(canPrint({ type: 'and', conditions: [{ type: 'true' }] })).toBe(false);
  });

  it('always returns false for in node', () => {
    expect(canPrint({ type: 'in', field: 'type', values: ['concept'] })).toBe(false);
  });

  it('always returns false for param node', () => {
    expect(canPrint({ type: 'param', name: 'userId' })).toBe(false);
  });
});

// ── print ─────────────────────────────────────────────────────────────────────

describe('print', () => {
  it('always returns null for true node', () => {
    expect(print({ type: 'true' })).toBeNull();
  });

  it('always returns null for false node', () => {
    expect(print({ type: 'false' })).toBeNull();
  });

  it('always returns null for eq node', () => {
    expect(print({ type: 'eq', field: 'status', value: 'active' })).toBeNull();
  });

  it('always returns null for and node', () => {
    expect(print({ type: 'and', conditions: [{ type: 'true' }] })).toBeNull();
  });

  it('always returns null for param node', () => {
    expect(print({ type: 'param', name: 'userId' })).toBeNull();
  });

  it('always returns null for in node', () => {
    expect(print({ type: 'in', field: 'type', values: ['a', 'b'] })).toBeNull();
  });

  it('always returns null for complex tree', () => {
    const node: FilterNode = {
      type: 'and',
      conditions: [
        { type: 'eq', field: 'owner', value: 'user-1' },
        { type: 'in', field: 'type', values: ['concept', 'sync'] },
      ],
    };
    expect(print(node)).toBeNull();
  });
});

// ── kind ──────────────────────────────────────────────────────────────────────

describe('kind', () => {
  it('exports kind as "contextual"', () => {
    expect(kind).toBe('contextual');
  });
});
