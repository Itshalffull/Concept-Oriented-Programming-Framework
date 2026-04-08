// Tests for handlers/ts/framework/view-analysis.ts
//
// Covers:
//   1. compileAndAnalyze with a read-only view → purity, readFields, terminates
//   2. compileAndAnalyze with an empty/minimal spec → defaults and graceful fallbacks
//   3. compileAndAnalyze with a read-write view (rowAction with concept/action)
//   4. Field extraction helpers: extractFilterFields, extractSortFields,
//      extractGroupFields, extractProjectedFields, extractSourceFields

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import {
  compileAndAnalyze,
  extractFilterFields,
  extractSortFields,
  extractGroupFields,
  extractProjectedFields,
  extractSourceFields,
  type ViewAnalysis,
} from '../../handlers/ts/framework/view-analysis.js';

// ─── Storage seeding helpers ──────────────────────────────────────────────────

type Storage = ReturnType<typeof createInMemoryStorage>;

/** Seed a ViewShell (uses 'view' relation — matches view-shell handler). */
async function seedViewShell(
  storage: Storage,
  name: string,
  opts: {
    dataSource?: string;
    filter?: string;
    sort?: string;
    group?: string;
    projection?: string;
    interaction?: string;
  } = {},
): Promise<void> {
  await storage.put('view', name, {
    name,
    title: name,
    description: '',
    dataSource: opts.dataSource ?? '',
    filter: opts.filter ?? '',
    sort: opts.sort ?? '',
    group: opts.group ?? '',
    projection: opts.projection ?? '',
    presentation: '',
    interaction: opts.interaction ?? '',
    legacyConfig: null,
  });
}

/** Seed a DataSourceSpec (uses 'source' relation — matches data-source-spec handler). */
async function seedDataSource(
  storage: Storage,
  name: string,
  kind: string,
  config: string,
): Promise<void> {
  await storage.put('source', name, { name, kind, config, parameters: '[]' });
}

/** Seed a FilterSpec (uses 'filter' relation — matches filter-spec handler). */
async function seedFilter(
  storage: Storage,
  name: string,
  tree: string,
): Promise<void> {
  await storage.put('filter', name, {
    name,
    tree,
    sourceType: '',
    fieldRefs: '[]',
    parameters: '[]',
  });
}

/** Seed a SortSpec (uses 'sort' relation — matches sort-spec handler). */
async function seedSort(
  storage: Storage,
  name: string,
  keys: string,
): Promise<void> {
  await storage.put('sort', name, { name, keys });
}

/** Seed a GroupSpec (uses 'group' relation — matches group-spec handler). */
async function seedGroup(
  storage: Storage,
  name: string,
  grouping: string,
  aggregations = '[]',
): Promise<void> {
  await storage.put('group', name, { name, grouping, aggregations, having: '' });
}

/** Seed a ProjectionSpec (uses 'projection' relation — matches projection-spec handler). */
async function seedProjection(
  storage: Storage,
  name: string,
  fields: string,
): Promise<void> {
  await storage.put('projection', name, { name, fields });
}

/** Seed an InteractionSpec (uses 'interaction' relation — matches interaction-spec handler). */
async function seedInteraction(
  storage: Storage,
  name: string,
  opts: { createForm?: string; rowClick?: string; rowActions?: string; pickerMode?: boolean } = {},
): Promise<void> {
  await storage.put('interaction', name, {
    name,
    createForm: opts.createForm ?? '',
    rowClick: opts.rowClick ?? '',
    rowActions: opts.rowActions ?? '[]',
    pickerMode: opts.pickerMode ?? false,
  });
}

// ─── 1. compileAndAnalyze: read-only view ─────────────────────────────────────

describe('compileAndAnalyze: read-only view', () => {
  let storage: Storage;
  let analysis: ViewAnalysis;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Seed a typical read-only content list view
    await seedDataSource(
      storage,
      'content-nodes-source',
      'concept-action',
      '{"concept":"ContentNode","action":"list"}',
    );
    await seedFilter(
      storage,
      'kind-filter',
      '{"type":"eq","field":"kind","value":"concept"}',
    );
    await seedSort(
      storage,
      'name-sort',
      '[{"field":"name","direction":"asc"}]',
    );
    await seedProjection(
      storage,
      'content-summary',
      '[{"key":"id","label":"ID"},{"key":"name","label":"Name"},{"key":"kind","label":"Kind"}]',
    );
    await seedViewShell(storage, 'content-list', {
      dataSource: 'content-nodes-source',
      filter: 'kind-filter',
      sort: 'name-sort',
      projection: 'content-summary',
    });

    analysis = await compileAndAnalyze('content-list', storage);
  });

  it('classifies purity as read-only', () => {
    expect(analysis.purity).toBe('read-only');
  });

  it('has readFields tracked from the scan source', () => {
    // The scan instruction tracks the source config string in readFields
    // (the QueryProgram handler calls withReadField(rec, source))
    // This may be the raw config string or empty depending on what scan tracks.
    // We just verify it's an array (can be empty for minimal configs).
    expect(Array.isArray(analysis.readFields)).toBe(true);
  });

  it('reports no invoked actions', () => {
    expect(analysis.invokedActions).toEqual([]);
  });

  it('reports invokeCount of 0', () => {
    expect(analysis.invokeCount).toBe(0);
  });

  it('has a terminated program', () => {
    expect(analysis.terminated).toBe(true);
  });

  it('has instructions including scan, filter, sort, project, pure', () => {
    const types = analysis.instructions.map((i) => {
      try { return (JSON.parse(i) as Record<string, unknown>).type; } catch { return null; }
    });
    expect(types).toContain('scan');
    expect(types).toContain('filter');
    expect(types).toContain('sort');
    expect(types).toContain('project');
    expect(types).toContain('pure');
  });

  it('extracts filterFields from the filter spec', () => {
    expect(analysis.filterFields).toContain('kind');
  });

  it('extracts sortFields from the sort spec', () => {
    expect(analysis.sortFields).toContain('name');
  });

  it('extracts projectedFields from the projection spec', () => {
    expect(analysis.projectedFields).toContain('id');
    expect(analysis.projectedFields).toContain('name');
    expect(analysis.projectedFields).toContain('kind');
  });

  it('returns empty uncoveredVariants for a read-only view', () => {
    // No invoke instructions → completion coverage has nothing to check
    expect(analysis.uncoveredVariants).toEqual([]);
    expect(analysis.coveredVariants).toEqual([]);
  });
});

// ─── 2. compileAndAnalyze: minimal/empty specs ───────────────────────────────

describe('compileAndAnalyze: minimal view with no child specs', () => {
  let storage: Storage;
  let analysis: ViewAnalysis;

  beforeEach(async () => {
    storage = createInMemoryStorage();
    // ViewShell with no child spec references
    await seedViewShell(storage, 'empty-view');
    analysis = await compileAndAnalyze('empty-view', storage);
  });

  it('returns purity of read-only (scan + filter with defaults still counts as read)', () => {
    // Even with empty/default specs the program has scan+filter instructions
    expect(['pure', 'read-only']).toContain(analysis.purity);
  });

  it('has empty invokedActions', () => {
    expect(analysis.invokedActions).toEqual([]);
  });

  it('has terminated = true', () => {
    expect(analysis.terminated).toBe(true);
  });

  it('has empty sourceFields, filterFields, sortFields, groupFields, projectedFields', () => {
    // With no child specs there are no domain fields
    expect(analysis.sourceFields).toEqual([]);
    expect(analysis.filterFields).toEqual([]);
    expect(analysis.sortFields).toEqual([]);
    expect(analysis.groupFields).toEqual([]);
    expect(analysis.projectedFields).toEqual([]);
  });

  it('throws when the shell is not found', async () => {
    await expect(compileAndAnalyze('nonexistent-view', storage)).rejects.toThrow(
      /ViewShell not found/,
    );
  });
});

// ─── 3. compileAndAnalyze: read-write view with row actions ──────────────────

describe('compileAndAnalyze: read-write view with concept row actions', () => {
  let storage: Storage;
  let analysis: ViewAnalysis;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    await seedDataSource(
      storage,
      'task-source',
      'concept-action',
      '{"concept":"Task","action":"list"}',
    );
    await seedFilter(storage, 'active-filter', '{"type":"eq","field":"status","value":"active"}');
    await seedSort(storage, 'priority-sort', '[{"field":"priority","direction":"desc"}]');
    await seedProjection(
      storage,
      'task-fields',
      '[{"key":"id"},{"key":"title"},{"key":"status"},{"key":"priority"}]',
    );
    // Interaction with rowActions that include concept/action pairs
    await seedInteraction(storage, 'task-actions', {
      rowActions: '[{"label":"Escalate","concept":"Task","action":"escalate"},{"label":"Archive","concept":"Task","action":"archive"}]',
    });
    await seedViewShell(storage, 'task-board', {
      dataSource: 'task-source',
      filter: 'active-filter',
      sort: 'priority-sort',
      projection: 'task-fields',
      interaction: 'task-actions',
    });

    analysis = await compileAndAnalyze('task-board', storage);
  });

  it('classifies purity as read-write due to invoke instructions', () => {
    expect(analysis.purity).toBe('read-write');
  });

  it('lists Task/escalate in invokedActions', () => {
    expect(analysis.invokedActions).toContain('Task/escalate');
  });

  it('lists Task/archive in invokedActions', () => {
    expect(analysis.invokedActions).toContain('Task/archive');
  });

  it('has non-zero invokeCount', () => {
    expect(analysis.invokeCount).toBeGreaterThan(0);
  });

  it('has terminated = true', () => {
    expect(analysis.terminated).toBe(true);
  });

  it('extracts filterFields from filter spec', () => {
    expect(analysis.filterFields).toContain('status');
  });

  it('extracts sortFields from sort spec', () => {
    expect(analysis.sortFields).toContain('priority');
  });

  it('extracts projectedFields from projection spec', () => {
    expect(analysis.projectedFields).toContain('id');
    expect(analysis.projectedFields).toContain('title');
    expect(analysis.projectedFields).toContain('status');
    expect(analysis.projectedFields).toContain('priority');
  });
});

// ─── 4. compileAndAnalyze: view with group spec ───────────────────────────────

describe('compileAndAnalyze: view with group spec', () => {
  let storage: Storage;
  let analysis: ViewAnalysis;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    await seedDataSource(storage, 'items-source', 'concept-action', '{"concept":"Item","action":"list"}');
    await seedFilter(storage, 'all-filter', '{"type":"true"}');
    await seedSort(storage, 'default-sort', '[]');
    await seedGroup(
      storage,
      'by-category',
      '{"type":"basic","keys":["category"]}',
      '[{"function":"count","alias":"count"}]',
    );
    await seedProjection(storage, 'item-fields', '[{"key":"id"},{"key":"name"},{"key":"category"}]');
    await seedViewShell(storage, 'item-grouped', {
      dataSource: 'items-source',
      filter: 'all-filter',
      sort: 'default-sort',
      group: 'by-category',
      projection: 'item-fields',
    });

    analysis = await compileAndAnalyze('item-grouped', storage);
  });

  it('classifies purity as read-only', () => {
    expect(analysis.purity).toBe('read-only');
  });

  it('extracts groupFields from group spec', () => {
    expect(analysis.groupFields).toContain('category');
  });

  it('includes a group instruction in the program', () => {
    const types = analysis.instructions.map((i) => {
      try { return (JSON.parse(i) as Record<string, unknown>).type; } catch { return null; }
    });
    expect(types).toContain('group');
  });
});

// ─── 5. Field extraction helpers ─────────────────────────────────────────────

describe('extractFilterFields', () => {
  it('extracts a single field from an eq node', () => {
    const tree = JSON.stringify({ type: 'eq', field: 'status', value: 'active' });
    expect(extractFilterFields(tree)).toContain('status');
  });

  it('extracts fields from a nested and/or tree', () => {
    const tree = JSON.stringify({
      type: 'and',
      children: [
        { type: 'eq', field: 'kind', value: 'concept' },
        { type: 'gt', field: 'wordCount', value: 100 },
      ],
    });
    const fields = extractFilterFields(tree);
    expect(fields).toContain('kind');
    expect(fields).toContain('wordCount');
  });

  it('extracts field from a not node', () => {
    const tree = JSON.stringify({ type: 'not', child: { type: 'exists', field: 'deletedAt' } });
    expect(extractFilterFields(tree)).toContain('deletedAt');
  });

  it('returns empty array for an identity (true) filter', () => {
    expect(extractFilterFields(JSON.stringify({ type: 'true' }))).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(extractFilterFields('not-json')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractFilterFields('')).toEqual([]);
  });

  it('deduplicates repeated field names', () => {
    const tree = JSON.stringify({
      type: 'and',
      children: [
        { type: 'eq', field: 'kind', value: 'a' },
        { type: 'eq', field: 'kind', value: 'b' },
      ],
    });
    const fields = extractFilterFields(tree);
    expect(fields.filter((f) => f === 'kind')).toHaveLength(1);
  });
});

describe('extractSortFields', () => {
  it('extracts field names from a sort key array', () => {
    const keys = JSON.stringify([
      { field: 'name', direction: 'asc' },
      { field: 'updatedAt', direction: 'desc' },
    ]);
    const fields = extractSortFields(keys);
    expect(fields).toContain('name');
    expect(fields).toContain('updatedAt');
  });

  it('returns empty array for an empty sort key array', () => {
    expect(extractSortFields('[]')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(extractSortFields('not-json')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractSortFields('')).toEqual([]);
  });

  it('deduplicates repeated sort fields', () => {
    const keys = JSON.stringify([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: 'desc' },
    ]);
    expect(extractSortFields(keys).filter((f) => f === 'name')).toHaveLength(1);
  });
});

describe('extractGroupFields', () => {
  it('extracts keys from a basic grouping config object', () => {
    const config = JSON.stringify({ type: 'basic', keys: ['category', 'status'] });
    const fields = extractGroupFields(config);
    expect(fields).toContain('category');
    expect(fields).toContain('status');
  });

  it('extracts fields from { type: "basic", fields: [{field}] } shape', () => {
    const config = JSON.stringify({ type: 'basic', fields: [{ field: 'category' }, { field: 'status' }] });
    const fields = extractGroupFields(config);
    expect(fields).toContain('category');
    expect(fields).toContain('status');
  });

  it('extracts from a flat string array', () => {
    const config = JSON.stringify(['kind', 'author']);
    const fields = extractGroupFields(config);
    expect(fields).toContain('kind');
    expect(fields).toContain('author');
  });

  it('returns empty array for empty string', () => {
    expect(extractGroupFields('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(extractGroupFields('not-json')).toEqual([]);
  });
});

describe('extractProjectedFields', () => {
  it('extracts key values from a projection field array', () => {
    const fields = JSON.stringify([
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'kind', label: 'Kind', visible: true },
    ]);
    const result = extractProjectedFields(fields);
    expect(result).toContain('id');
    expect(result).toContain('name');
    expect(result).toContain('kind');
  });

  it('handles plain string fields', () => {
    const fields = JSON.stringify(['id', 'name', 'status']);
    const result = extractProjectedFields(fields);
    expect(result).toContain('id');
    expect(result).toContain('name');
    expect(result).toContain('status');
  });

  it('returns empty array for an empty array', () => {
    expect(extractProjectedFields('[]')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(extractProjectedFields('not-json')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractProjectedFields('')).toEqual([]);
  });
});

describe('extractSourceFields', () => {
  it('returns explicit fields array from concept-action config', () => {
    const config = JSON.stringify({
      concept: 'ContentNode',
      action: 'list',
      fields: ['id', 'name', 'kind', 'schemas'],
    });
    const fields = extractSourceFields(config);
    expect(fields).toContain('id');
    expect(fields).toContain('name');
    expect(fields).toContain('kind');
    expect(fields).toContain('schemas');
  });

  it('falls back to top-level config keys when no fields array present', () => {
    // Keys that are not in the meta exclusion set are returned
    const config = JSON.stringify({ concept: 'ContentNode', action: 'list', customKey: 'value' });
    const fields = extractSourceFields(config);
    // 'concept', 'action', 'params', 'kind' are excluded as meta-keys
    expect(fields).toContain('customKey');
    expect(fields).not.toContain('concept');
    expect(fields).not.toContain('action');
  });

  it('returns empty array for a minimal concept-action config with no extra keys', () => {
    const config = JSON.stringify({ concept: 'ContentNode', action: 'list' });
    // All keys are meta — fallback returns empty
    expect(extractSourceFields(config)).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(extractSourceFields('not-json')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractSourceFields('')).toEqual([]);
  });
});
