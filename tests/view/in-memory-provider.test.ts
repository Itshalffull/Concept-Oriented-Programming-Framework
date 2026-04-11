/**
 * Tests for InMemoryProvider — full client-side QueryProgram evaluation.
 *
 * Covers the full instruction pipeline (filter → sort → limit), group with
 * aggregation, project field selection, empty program, and planPushdown.
 */

import { describe, expect, it } from 'vitest';
import {
  execute,
  planPushdown,
  name,
  kind,
  capabilities,
} from '../../handlers/ts/view/providers/in-memory-provider.js';
import type {
  QueryProgram,
  FilterNode,
  SortKey,
  GroupSpec,
  ProjectionField,
  GroupBucket,
} from '../../handlers/ts/view/providers/in-memory-provider.js';

// ─── test data ────────────────────────────────────────────────────────────────

const PEOPLE: Record<string, unknown>[] = [
  { id: '1', name: 'Alice', age: 30, dept: 'eng', score: 90 },
  { id: '2', name: 'Bob', age: 25, dept: 'eng', score: 70 },
  { id: '3', name: 'Carol', age: 35, dept: 'hr', score: 85 },
  { id: '4', name: 'Dave', age: 28, dept: 'hr', score: 60 },
  { id: '5', name: 'Eve', age: 22, dept: 'eng', score: 95 },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function filterProgram(filter: FilterNode): QueryProgram {
  return { instructions: [{ type: 'filter', filter }] };
}

function sortProgram(keys: SortKey[]): QueryProgram {
  return { instructions: [{ type: 'sort', keys }] };
}

function limitProgram(count?: number, offset?: number): QueryProgram {
  return { instructions: [{ type: 'limit', count, offset }] };
}

// ─── empty program ─────────────────────────────────────────────────────────────

describe('empty program', () => {
  it('returns empty rows when program has no instructions', () => {
    const result = execute({ instructions: [] }, PEOPLE);
    expect(result).toEqual([]);
  });

  it('returns empty rows when data is empty and no scan', () => {
    const result = execute({ instructions: [{ type: 'filter', filter: { type: 'true' } }] }, []);
    expect(result).toEqual([]);
  });

  it('returns empty rows when called with no data arg and no scan', () => {
    const result = execute({ instructions: [{ type: 'filter', filter: { type: 'true' } }] });
    expect(result).toEqual([]);
  });
});

// ─── scan ─────────────────────────────────────────────────────────────────────

describe('scan instruction', () => {
  it('extracts inline rows from source config', () => {
    const inlineRows = [{ id: 'a', val: 1 }, { id: 'b', val: 2 }];
    const program: QueryProgram = {
      instructions: [
        { type: 'scan', source: { kind: 'inline', rows: inlineRows } },
      ],
    };
    const result = execute(program, []);
    expect(result).toEqual(inlineRows);
  });

  it('falls back to provided data for non-inline source', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'scan', source: { kind: 'concept-action', concept: 'Foo', action: 'list' } },
      ],
    };
    const result = execute(program, PEOPLE);
    expect(result).toEqual(PEOPLE);
  });

  it('scan then filter applies filter on inline data', () => {
    const inlineRows = [{ id: '1', active: true }, { id: '2', active: false }];
    const program: QueryProgram = {
      instructions: [
        { type: 'scan', source: { kind: 'inline', rows: inlineRows } },
        { type: 'filter', filter: { type: 'eq', field: 'active', value: true } },
      ],
    };
    const result = execute(program, []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '1', active: true });
  });
});

// ─── filter ───────────────────────────────────────────────────────────────────

describe('filter instruction', () => {
  it('true filter passes all rows', () => {
    const result = execute(filterProgram({ type: 'true' }), PEOPLE);
    expect(result).toHaveLength(PEOPLE.length);
  });

  it('false filter passes no rows', () => {
    const result = execute(filterProgram({ type: 'false' }), PEOPLE);
    expect(result).toHaveLength(0);
  });

  it('eq filter selects matching rows', () => {
    const result = execute(
      filterProgram({ type: 'eq', field: 'dept', value: 'eng' }),
      PEOPLE,
    );
    expect(result).toHaveLength(3);
    result.forEach(r => expect(r.dept).toBe('eng'));
  });

  it('in filter matches any of the listed values', () => {
    const result = execute(
      filterProgram({ type: 'in', field: 'dept', values: ['eng'] }),
      PEOPLE,
    );
    expect(result).toHaveLength(3);
  });

  it('gt filter selects rows with field greater than value', () => {
    const result = execute(
      filterProgram({ type: 'gt', field: 'age', value: 28 }),
      PEOPLE,
    );
    // Alice (30), Carol (35)
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.age as number).toBeGreaterThan(28));
  });

  it('and filter ANDs conditions together', () => {
    const filter: FilterNode = {
      type: 'and',
      conditions: [
        { type: 'eq', field: 'dept', value: 'eng' },
        { type: 'gt', field: 'score', value: 80 },
      ],
    };
    const result = execute(filterProgram(filter), PEOPLE);
    // Alice (eng, 90) and Eve (eng, 95)
    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(r.dept).toBe('eng');
      expect(r.score as number).toBeGreaterThan(80);
    });
  });

  it('function contains filter matches substring', () => {
    const result = execute(
      filterProgram({ type: 'function', name: 'contains', field: 'name', value: 'a' }),
      PEOPLE,
    );
    // Carol, Dave (contain lowercase 'a' — Carol has 'a', Dave has 'a')
    expect(result.length).toBeGreaterThan(0);
    result.forEach(r => expect(String(r.name).toLowerCase()).toContain('a'));
  });
});

// ─── sort ─────────────────────────────────────────────────────────────────────

describe('sort instruction', () => {
  it('sorts ascending by a string field', () => {
    const result = execute(
      sortProgram([{ field: 'name', direction: 'asc' }]),
      PEOPLE,
    );
    const names = result.map(r => r.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts descending by a numeric field', () => {
    const result = execute(
      sortProgram([{ field: 'score', direction: 'desc' }]),
      PEOPLE,
    );
    const scores = result.map(r => r.score as number);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  it('multi-key sort: primary asc, secondary desc', () => {
    const result = execute(
      sortProgram([
        { field: 'dept', direction: 'asc' },
        { field: 'score', direction: 'desc' },
      ]),
      PEOPLE,
    );
    // eng group: Eve(95), Alice(90), Bob(70); hr group: Carol(85), Dave(60)
    const depts = result.map(r => r.dept);
    const engRows = result.filter(r => r.dept === 'eng');
    const hrRows = result.filter(r => r.dept === 'hr');
    expect(depts.indexOf('eng')).toBeLessThan(depts.indexOf('hr'));
    expect(engRows[0].score).toBe(95);
    expect(hrRows[0].score).toBe(85);
  });

  it('stable sort preserves relative order for equal keys', () => {
    const data = [
      { id: 'a', group: 1 },
      { id: 'b', group: 1 },
      { id: 'c', group: 1 },
    ];
    const result = execute(sortProgram([{ field: 'group', direction: 'asc' }]), data);
    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─── filter → sort → limit pipeline ──────────────────────────────────────────

describe('full pipeline: filter → sort → limit', () => {
  it('filters eng dept, sorts by score desc, limits to top 2', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'filter', filter: { type: 'eq', field: 'dept', value: 'eng' } },
        { type: 'sort', keys: [{ field: 'score', direction: 'desc' }] },
        { type: 'limit', count: 2 },
      ],
    };
    const result = execute(program, PEOPLE);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: 'Eve', score: 95 });
    expect(result[1]).toMatchObject({ name: 'Alice', score: 90 });
  });

  it('offset skips leading rows after sort', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'sort', keys: [{ field: 'score', direction: 'asc' }] },
        { type: 'limit', count: 2, offset: 2 },
      ],
    };
    const result = execute(program, PEOPLE);
    // Sorted asc: Dave(60), Bob(70), Carol(85), Alice(90), Eve(95)
    // offset 2 → Carol(85), Alice(90)
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: 'Carol' });
    expect(result[1]).toMatchObject({ name: 'Alice' });
  });

  it('limit with offset beyond length returns empty', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'limit', count: 10, offset: 100 },
      ],
    };
    const result = execute(program, PEOPLE);
    expect(result).toEqual([]);
  });

  it('limit with no count and offset = 0 returns all rows', () => {
    const result = execute(limitProgram(undefined, 0), PEOPLE);
    expect(result).toEqual(PEOPLE);
  });
});

// ─── group + aggregation ──────────────────────────────────────────────────────

describe('group instruction', () => {
  it('groups rows by a single field and counts each group', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [{ function: 'count', alias: 'count' }],
    };
    const program: QueryProgram = {
      instructions: [{ type: 'group', spec }],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    expect(result).toHaveLength(2);
    const engBucket = result.find(b => b.key.dept === 'eng');
    const hrBucket = result.find(b => b.key.dept === 'hr');
    expect(engBucket?.aggregates.count).toBe(3);
    expect(hrBucket?.aggregates.count).toBe(2);
  });

  it('computes sum aggregation over a numeric field', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [{ function: 'sum', field: 'score', alias: 'totalScore' }],
    };
    const program: QueryProgram = {
      instructions: [{ type: 'group', spec }],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    const engBucket = result.find(b => b.key.dept === 'eng');
    // Alice(90) + Bob(70) + Eve(95) = 255
    expect(engBucket?.aggregates.totalScore).toBe(255);
  });

  it('computes avg aggregation', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [{ function: 'avg', field: 'score', alias: 'avgScore' }],
    };
    const program: QueryProgram = {
      instructions: [{ type: 'group', spec }],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    const hrBucket = result.find(b => b.key.dept === 'hr');
    // Carol(85) + Dave(60) = 145 / 2 = 72.5
    expect(hrBucket?.aggregates.avgScore).toBe(72.5);
  });

  it('computes min and max aggregations', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [
        { function: 'min', field: 'age', alias: 'minAge' },
        { function: 'max', field: 'age', alias: 'maxAge' },
      ],
    };
    const program: QueryProgram = {
      instructions: [{ type: 'group', spec }],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    const engBucket = result.find(b => b.key.dept === 'eng');
    // eng ages: Alice(30), Bob(25), Eve(22) → min=22, max=30
    expect(engBucket?.aggregates.minAge).toBe(22);
    expect(engBucket?.aggregates.maxAge).toBe(30);
  });

  it('computes array_agg aggregation', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [{ function: 'array_agg', field: 'name', alias: 'names' }],
    };
    const program: QueryProgram = {
      instructions: [{ type: 'group', spec }],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    const hrBucket = result.find(b => b.key.dept === 'hr');
    expect(Array.isArray(hrBucket?.aggregates.names)).toBe(true);
    expect((hrBucket?.aggregates.names as string[]).sort()).toEqual(['Carol', 'Dave']);
  });

  it('group then sort sorts buckets by aggregate field', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [{ function: 'count', alias: 'count' }],
    };
    const program: QueryProgram = {
      instructions: [
        { type: 'group', spec },
        { type: 'sort', keys: [{ field: 'count', direction: 'desc' }] },
      ],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    expect(result[0].aggregates.count).toBeGreaterThanOrEqual(result[1].aggregates.count as number);
  });

  it('group then limit restricts bucket count', () => {
    const spec: GroupSpec = {
      grouping: { fields: [{ field: 'dept' }] },
      aggregations: [{ function: 'count', alias: 'count' }],
    };
    const program: QueryProgram = {
      instructions: [
        { type: 'group', spec },
        { type: 'limit', count: 1 },
      ],
    };
    const result = execute(program, PEOPLE) as unknown as GroupBucket[];
    expect(result).toHaveLength(1);
  });
});

// ─── project ──────────────────────────────────────────────────────────────────

describe('project instruction', () => {
  const fields: ProjectionField[] = [
    { key: 'id' },
    { key: 'name' },
  ];

  it('selects only declared fields', () => {
    const program: QueryProgram = {
      instructions: [{ type: 'project', fields }],
    };
    const result = execute(program, PEOPLE);
    result.forEach(r => {
      expect(Object.keys(r).sort()).toEqual(['id', 'name']);
    });
  });

  it('excludes fields with visible === false', () => {
    const fieldsWithHidden: ProjectionField[] = [
      { key: 'id' },
      { key: 'name' },
      { key: 'age', visible: false },
    ];
    const program: QueryProgram = {
      instructions: [{ type: 'project', fields: fieldsWithHidden }],
    };
    const result = execute(program, PEOPLE);
    result.forEach(r => {
      expect(Object.keys(r)).not.toContain('age');
      expect(Object.keys(r)).toContain('id');
      expect(Object.keys(r)).toContain('name');
    });
  });

  it('preserves undefined for fields not present in source row', () => {
    const data = [{ id: '1', name: 'Test' }];
    const program: QueryProgram = {
      instructions: [{ type: 'project', fields: [{ key: 'id' }, { key: 'missing' }] }],
    };
    const result = execute(program, data);
    expect(result[0]).toMatchObject({ id: '1' });
    expect('missing' in result[0]).toBe(true);
    expect(result[0].missing).toBeUndefined();
  });
});

// ─── full filter → sort → project → limit pipeline ───────────────────────────

describe('combined filter → sort → project → limit', () => {
  it('chains all four instructions correctly', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'filter', filter: { type: 'eq', field: 'dept', value: 'eng' } },
        { type: 'sort', keys: [{ field: 'score', direction: 'desc' }] },
        { type: 'project', fields: [{ key: 'id' }, { key: 'name' }, { key: 'score' }] },
        { type: 'limit', count: 2 },
      ],
    };
    const result = execute(program, PEOPLE);
    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(Object.keys(r).sort()).toEqual(['id', 'name', 'score']);
    });
    expect(result[0]).toMatchObject({ name: 'Eve', score: 95 });
    expect(result[1]).toMatchObject({ name: 'Alice', score: 90 });
  });
});

// ─── planPushdown ─────────────────────────────────────────────────────────────

describe('planPushdown', () => {
  it('returns all instructions as pushdown, residual is empty', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'filter', filter: { type: 'true' } },
        { type: 'sort', keys: [{ field: 'name', direction: 'asc' }] },
        { type: 'limit', count: 10 },
      ],
    };
    const plan = planPushdown(program);
    expect(plan.pushdown).toEqual(program.instructions);
    expect(plan.residual).toEqual([]);
  });

  it('handles empty program — pushdown and residual are both empty', () => {
    const plan = planPushdown({ instructions: [] });
    expect(plan.pushdown).toEqual([]);
    expect(plan.residual).toEqual([]);
  });

  it('full pipeline instructions are all pushdown', () => {
    const program: QueryProgram = {
      instructions: [
        { type: 'scan', source: { kind: 'inline', rows: [] } },
        { type: 'filter', filter: { type: 'true' } },
        { type: 'sort', keys: [{ field: 'name', direction: 'asc' }] },
        { type: 'group', spec: { grouping: { fields: [{ field: 'dept' }] } } },
        { type: 'project', fields: [{ key: 'id' }] },
        { type: 'limit', count: 5 },
      ],
    };
    const plan = planPushdown(program);
    expect(plan.pushdown).toHaveLength(6);
    expect(plan.residual).toHaveLength(0);
  });
});

// ─── provider metadata ────────────────────────────────────────────────────────

describe('provider metadata', () => {
  it('exports name = "in-memory"', () => {
    expect(name).toBe('in-memory');
  });

  it('exports kind = "in-memory"', () => {
    expect(kind).toBe('in-memory');
  });

  it('exports all expected capabilities', () => {
    expect(capabilities).toContain('filter');
    expect(capabilities).toContain('sort');
    expect(capabilities).toContain('group');
    expect(capabilities).toContain('project');
    expect(capabilities).toContain('limit');
    expect(capabilities).toContain('offset');
    expect(capabilities).toHaveLength(6);
  });
});
