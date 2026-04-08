/**
 * Tests for KernelQueryProvider.
 *
 * Covers:
 *   planPushdown — splits scan from filter/sort/limit/group/project
 *   execute      — applies filter and sort to rows; handles empty programs
 *   execute      — handles invalid program JSON gracefully
 */

import { describe, it, expect } from 'vitest';
import {
  execute,
  planPushdown,
  kernelQueryProvider,
} from '../../handlers/ts/view/providers/kernel-query-provider';
import type { QueryProgram, Instruction } from '../../handlers/ts/view/providers/kernel-query-provider';

// ── helpers ───────────────────────────────────────────────────────────────────

function program(...instructions: Instruction[]): string {
  return JSON.stringify({ instructions } satisfies QueryProgram);
}

const rows: Record<string, unknown>[] = [
  { id: '1', kind: 'concept', name: 'Article', priority: 2 },
  { id: '2', kind: 'sync',    name: 'LoginSync', priority: 1 },
  { id: '3', kind: 'concept', name: 'User', priority: 3 },
  { id: '4', kind: 'widget',  name: 'Button', priority: 1 },
];

// ── planPushdown ──────────────────────────────────────────────────────────────

describe('planPushdown', () => {
  it('splits scan into pushdown and filter into residual', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'filter', node: { type: 'eq', field: 'kind', value: 'concept' }, bindAs: 'filtered' },
    );
    const plan = planPushdown(json);
    expect(plan).not.toBeNull();
    expect(plan!.pushdown.instructions).toHaveLength(2);
    expect(plan!.pushdown.instructions.map(i => i.type)).toEqual(['scan', 'filter']);
    expect(plan!.residual.instructions).toHaveLength(0);
  });

  it('pushes scan and sort to kernel', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'sort', keys: [{ field: 'name', direction: 'asc' }], bindAs: 'sorted' },
    );
    const plan = planPushdown(json);
    expect(plan).not.toBeNull();
    expect(plan!.pushdown.instructions).toHaveLength(2);
    expect(plan!.pushdown.instructions.map(i => i.type)).toEqual(['scan', 'sort']);
    expect(plan!.residual.instructions).toHaveLength(0);
  });

  it('pushes scan, filter, and sort to kernel', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'filter', node: { type: 'true' }, bindAs: 'filtered' },
      { type: 'sort', keys: [{ field: 'name', direction: 'asc' }], bindAs: 'sorted' },
    );
    const plan = planPushdown(json);
    expect(plan).not.toBeNull();
    expect(plan!.pushdown.instructions).toHaveLength(3);
    expect(plan!.pushdown.instructions.map(i => i.type)).toEqual(['scan', 'filter', 'sort']);
    expect(plan!.residual.instructions).toHaveLength(0);
  });

  it('pushes limit to kernel', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'limit', count: 10, output: 'page' },
    );
    const plan = planPushdown(json);
    expect(plan!.pushdown.instructions).toHaveLength(2);
    expect(plan!.pushdown.instructions.map(i => i.type)).toEqual(['scan', 'limit']);
  });

  it('puts group in residual', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'group', keys: ['kind'], config: { aggregate: 'count' }, bindAs: 'grouped' },
    );
    const plan = planPushdown(json);
    expect(plan!.residual.instructions[0].type).toBe('group');
  });

  it('puts project in residual', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'project', fields: ['id', 'name'], bindAs: 'projected' },
    );
    const plan = planPushdown(json);
    expect(plan!.residual.instructions[0].type).toBe('project');
  });

  it('multiple scans and filter all go into pushdown', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'scan', source: 'schemas', bindAs: 'schemas' },
      { type: 'filter', node: { type: 'true' }, bindAs: 'filtered' },
    );
    const plan = planPushdown(json);
    expect(plan!.pushdown.instructions).toHaveLength(3);
    expect(plan!.residual.instructions).toHaveLength(0);
  });

  it('empty program → both partitions empty', () => {
    const json = program();
    const plan = planPushdown(json);
    expect(plan).not.toBeNull();
    expect(plan!.pushdown.instructions).toHaveLength(0);
    expect(plan!.residual.instructions).toHaveLength(0);
  });

  it('program with no scan → filter and sort pushed to kernel', () => {
    const json = program(
      { type: 'filter', node: { type: 'eq', field: 'kind', value: 'concept' }, bindAs: 'filtered' },
      { type: 'sort', keys: [{ field: 'name', direction: 'asc' }], bindAs: 'sorted' },
    );
    const plan = planPushdown(json);
    expect(plan!.pushdown.instructions).toHaveLength(2);
    expect(plan!.residual.instructions).toHaveLength(0);
  });

  it('returns null on invalid JSON', () => {
    expect(planPushdown('not-json')).toBeNull();
  });

  it('returns null on empty string', () => {
    expect(planPushdown('')).toBeNull();
  });
});

// ── execute — filter ──────────────────────────────────────────────────────────

describe('execute — filter', () => {
  it('filters rows by eq predicate', () => {
    const json = program(
      { type: 'filter', node: { type: 'eq', field: 'kind', value: 'concept' }, bindAs: 'filtered' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(2);
    expect(result.rows!.every(r => r.kind === 'concept')).toBe(true);
  });

  it('filter with true node passes all rows', () => {
    const json = program(
      { type: 'filter', node: { type: 'true' }, bindAs: 'filtered' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(rows.length);
  });

  it('filter with false node removes all rows', () => {
    const json = program(
      { type: 'filter', node: { type: 'false' }, bindAs: 'filtered' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(0);
  });

  it('filter with in node matches multiple values', () => {
    const json = program(
      { type: 'filter', node: { type: 'in', field: 'kind', values: ['concept', 'widget'] }, bindAs: 'filtered' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(3);
  });

  it('filter with and node combines predicates', () => {
    const json = program({
      type: 'filter',
      node: {
        type: 'and',
        conditions: [
          { type: 'eq', field: 'kind', value: 'concept' },
          { type: 'gt', field: 'priority', value: 2 },
        ],
      },
      bindAs: 'filtered',
    });
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(1);
    expect(result.rows![0].name).toBe('User');
  });
});

// ── execute — sort ────────────────────────────────────────────────────────────

describe('execute — sort', () => {
  it('sorts rows ascending by field', () => {
    const json = program(
      { type: 'sort', keys: [{ field: 'name', direction: 'asc' }], bindAs: 'sorted' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    const names = result.rows!.map(r => r.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts rows descending by field', () => {
    const json = program(
      { type: 'sort', keys: [{ field: 'priority', direction: 'desc' }], bindAs: 'sorted' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    const priorities = result.rows!.map(r => r.priority as number);
    expect(priorities[0]).toBeGreaterThanOrEqual(priorities[priorities.length - 1]);
  });

  it('empty sort keys leaves order unchanged', () => {
    const json = program(
      { type: 'sort', keys: [], bindAs: 'sorted' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows!.map(r => r.id)).toEqual(['1', '2', '3', '4']);
  });

  it('multi-key sort: primary ascending then tiebreak descending', () => {
    const tieRows: Record<string, unknown>[] = [
      { id: 'a', kind: 'concept', priority: 1 },
      { id: 'b', kind: 'concept', priority: 2 },
      { id: 'c', kind: 'sync',    priority: 1 },
    ];
    const json = program({
      type: 'sort',
      keys: [
        { field: 'kind', direction: 'asc' },
        { field: 'priority', direction: 'desc' },
      ],
      bindAs: 'sorted',
    });
    const result = execute(json, tieRows);
    expect(result.variant).toBe('ok');
    // 'concept' rows come first (asc), ordered by priority desc: b(2), a(1)
    // then 'sync' row: c
    expect(result.rows!.map(r => r.id)).toEqual(['b', 'a', 'c']);
  });
});

// ── execute — limit ───────────────────────────────────────────────────────────

describe('execute — limit', () => {
  it('truncates rows to count', () => {
    const json = program(
      { type: 'limit', count: 2, output: 'page' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(2);
    expect(result.rows![0].id).toBe('1');
    expect(result.rows![1].id).toBe('2');
  });

  it('limit of 0 returns empty set', () => {
    const json = program({ type: 'limit', count: 0, output: 'page' });
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(0);
  });

  it('limit larger than row count returns all rows', () => {
    const json = program({ type: 'limit', count: 100, output: 'page' });
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(rows.length);
  });
});

// ── execute — scan ────────────────────────────────────────────────────────────

describe('execute — scan', () => {
  it('scan instruction records source in metadata and passes rows through', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(rows.length);
    expect(result.metadata!.scanSource).toBe('contentNodes');
  });

  it('scan followed by filter: filter is applied to provided rows', () => {
    const json = program(
      { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
      { type: 'filter', node: { type: 'eq', field: 'kind', value: 'concept' }, bindAs: 'filtered' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows!.every(r => r.kind === 'concept')).toBe(true);
    expect(result.metadata!.scanSource).toBe('contentNodes');
  });
});

// ── execute — composed pipeline ───────────────────────────────────────────────

describe('execute — composed pipeline', () => {
  it('filter → sort → limit pipeline produces correct result', () => {
    const json = program(
      { type: 'filter', node: { type: 'eq', field: 'kind', value: 'concept' }, bindAs: 'filtered' },
      { type: 'sort', keys: [{ field: 'name', direction: 'desc' }], bindAs: 'sorted' },
      { type: 'limit', count: 1, output: 'page' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(1);
    // Concepts: 'User' (priority 3) and 'Article' (priority 2); desc by name → 'User' first
    expect(result.rows![0].name).toBe('User');
  });

  it('project reduces fields', () => {
    const json = program(
      { type: 'project', fields: ['id', 'kind'], bindAs: 'projected' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows!.every(r => !('name' in r) && !('priority' in r))).toBe(true);
    expect(result.rows!.every(r => 'id' in r && 'kind' in r)).toBe(true);
  });

  it('project with no matching fields returns rows with empty objects', () => {
    const json = program(
      { type: 'project', fields: ['nonexistent'], bindAs: 'projected' },
    );
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows!.every(r => Object.keys(r).length === 0)).toBe(true);
  });
});

// ── execute — empty program ───────────────────────────────────────────────────

describe('execute — empty program', () => {
  it('empty instructions array returns rows unchanged', () => {
    const json = program();
    const result = execute(json, rows);
    expect(result.variant).toBe('ok');
    expect(result.rows).toEqual(rows);
    expect(result.metadata!.instructionsApplied).toBe(0);
  });

  it('empty program with no rows returns empty rows', () => {
    const json = program();
    const result = execute(json, []);
    expect(result.variant).toBe('ok');
    expect(result.rows).toEqual([]);
  });

  it('default rows argument is empty array', () => {
    const json = program();
    const result = execute(json);
    expect(result.variant).toBe('ok');
    expect(result.rows).toEqual([]);
  });
});

// ── execute — invalid input ───────────────────────────────────────────────────

describe('execute — invalid input', () => {
  it('invalid JSON returns error variant', () => {
    const result = execute('not-json', rows);
    expect(result.variant).toBe('error');
    expect(result.message).toBeTruthy();
  });

  it('empty string returns error variant', () => {
    const result = execute('', rows);
    expect(result.variant).toBe('error');
  });

  it('JSON without instructions field returns error', () => {
    const result = execute('{}', rows);
    expect(result.variant).toBe('error');
  });

  it('null JSON returns error', () => {
    const result = execute('null', rows);
    expect(result.variant).toBe('error');
  });

  it('instructions not an array returns error', () => {
    const result = execute('{"instructions":"oops"}', rows);
    expect(result.variant).toBe('error');
  });
});

// ── provider export ───────────────────────────────────────────────────────────

describe('kernelQueryProvider export', () => {
  it('has correct name', () => {
    expect(kernelQueryProvider.name).toBe('default-kernel');
  });

  it('has correct kind', () => {
    expect(kernelQueryProvider.kind).toBe('kernel');
  });

  it('capabilities includes filter, sort, limit', () => {
    expect(kernelQueryProvider.capabilities).toContain('filter');
    expect(kernelQueryProvider.capabilities).toContain('sort');
    expect(kernelQueryProvider.capabilities).toContain('limit');
  });

  it('exposes execute function', () => {
    expect(typeof kernelQueryProvider.execute).toBe('function');
  });

  it('exposes planPushdown function', () => {
    expect(typeof kernelQueryProvider.planPushdown).toBe('function');
  });
});
