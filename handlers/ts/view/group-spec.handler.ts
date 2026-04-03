// @clef-handler style=functional concept=GroupSpec
// GroupSpec Concept Implementation — Functional (StorageProgram) style
//
// Implements named grouping specifications that cluster records into hierarchical
// groups and compute aggregations over each group. Supports basic field-based
// grouping and aggregation functions: count, sum, avg, min, max, array_agg.
// See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── GroupingConfig types ──────────────────────────────────────────────────

interface GroupingField {
  field: string;
  sort?: 'asc' | 'desc';
}

interface GroupingConfig {
  type: 'basic';
  fields: GroupingField[];
}

// ─── AggregationDef types ──────────────────────────────────────────────────

interface AggregationDef {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'array_agg';
  field?: string;
  alias: string;
}

// ─── GroupResult type ──────────────────────────────────────────────────────

interface GroupBucket {
  key: Record<string, unknown>;
  rows: Record<string, unknown>[];
  aggregates: Record<string, unknown>;
}

// ─── Grouping logic ────────────────────────────────────────────────────────

function buildGroupKey(row: Record<string, unknown>, fields: GroupingField[]): string {
  const parts: unknown[] = fields.map(f => {
    const val = row[f.field];
    return Array.isArray(val) ? val.slice().sort().join(',') : val;
  });
  return JSON.stringify(parts);
}

function buildKeyObject(row: Record<string, unknown>, fields: GroupingField[]): Record<string, unknown> {
  const key: Record<string, unknown> = {};
  for (const f of fields) {
    key[f.field] = row[f.field];
  }
  return key;
}

function computeAggregations(
  rows: Record<string, unknown>[],
  defs: AggregationDef[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const def of defs) {
    switch (def.function) {
      case 'count':
        result[def.alias] = rows.length;
        break;
      case 'sum': {
        const field = def.field;
        if (!field) { result[def.alias] = null; break; }
        const total = rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
        result[def.alias] = total;
        break;
      }
      case 'avg': {
        const field = def.field;
        if (!field || rows.length === 0) { result[def.alias] = null; break; }
        const sum = rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
        result[def.alias] = sum / rows.length;
        break;
      }
      case 'min': {
        const field = def.field;
        if (!field || rows.length === 0) { result[def.alias] = null; break; }
        const vals = rows.map(r => r[field]).filter(v => v !== null && v !== undefined);
        result[def.alias] = vals.length > 0 ? vals.reduce((a, b) => (a as number) < (b as number) ? a : b) : null;
        break;
      }
      case 'max': {
        const field = def.field;
        if (!field || rows.length === 0) { result[def.alias] = null; break; }
        const vals = rows.map(r => r[field]).filter(v => v !== null && v !== undefined);
        result[def.alias] = vals.length > 0 ? vals.reduce((a, b) => (a as number) > (b as number) ? a : b) : null;
        break;
      }
      case 'array_agg': {
        const field = def.field;
        if (!field) { result[def.alias] = []; break; }
        result[def.alias] = rows.map(r => r[field]);
        break;
      }
    }
  }
  return result;
}

function groupRows(
  rows: Record<string, unknown>[],
  config: GroupingConfig,
  defs: AggregationDef[],
): GroupBucket[] {
  const bucketMap = new Map<string, { key: Record<string, unknown>; rows: Record<string, unknown>[] }>();

  for (const row of rows) {
    const keyStr = buildGroupKey(row, config.fields);
    if (!bucketMap.has(keyStr)) {
      bucketMap.set(keyStr, { key: buildKeyObject(row, config.fields), rows: [] });
    }
    bucketMap.get(keyStr)!.rows.push(row);
  }

  // Sort buckets by first grouping field (if sort specified)
  const buckets = Array.from(bucketMap.values());
  const firstField = config.fields[0];
  if (firstField && firstField.sort) {
    buckets.sort((a, b) => {
      const av = a.key[firstField.field];
      const bv = b.key[firstField.field];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return firstField.sort === 'desc' ? -cmp : cmp;
    });
  }

  return buckets.map(b => ({
    key: b.key,
    rows: b.rows,
    aggregates: computeAggregations(b.rows, defs),
  }));
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const groupingRaw = input.grouping;
    const aggregationsRaw = input.aggregations;

    // Input validation guards
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Validate grouping JSON
    let groupingStr: string;
    if (typeof groupingRaw === 'string') {
      try {
        JSON.parse(groupingRaw);
        groupingStr = groupingRaw;
      } catch {
        return complete(createProgram(), 'error', { message: 'grouping is not valid JSON' }) as StorageProgram<Result>;
      }
    } else if (groupingRaw && typeof groupingRaw === 'object') {
      groupingStr = JSON.stringify(groupingRaw);
    } else {
      groupingStr = '{}';
    }

    // Validate aggregations JSON
    let aggregationsStr: string;
    if (typeof aggregationsRaw === 'string') {
      try {
        JSON.parse(aggregationsRaw);
        aggregationsStr = aggregationsRaw;
      } catch {
        return complete(createProgram(), 'error', { message: 'aggregations is not valid JSON' }) as StorageProgram<Result>;
      }
    } else if (Array.isArray(aggregationsRaw)) {
      aggregationsStr = JSON.stringify(aggregationsRaw);
    } else {
      aggregationsStr = '[]';
    }

    let p = createProgram();
    p = get(p, 'group', name, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => completeFrom(b, 'duplicate', (bindings) => ({
        group: (bindings.existing as Record<string, unknown>).name,
      })),
      (b) => {
        const b2 = put(b, 'group', name, {
          name,
          grouping: groupingStr,
          aggregations: aggregationsStr,
          having: '',
        });
        return complete(b2, 'ok', { group: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'group', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Group spec "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          group: rec.name as string,
          grouping: rec.grouping as string,
          aggregations: rec.aggregations as string,
          having: (rec.having as string) ?? '',
        };
      }),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const name = input.name as string;
    const rowsRaw = input.rows;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Parse rows — must be a JSON array
    let rows: Record<string, unknown>[];
    if (Array.isArray(rowsRaw)) {
      rows = rowsRaw as Record<string, unknown>[];
    } else if (typeof rowsRaw === 'string') {
      try {
        const parsed = JSON.parse(rowsRaw);
        if (!Array.isArray(parsed)) {
          return complete(createProgram(), 'error', { message: 'rows must be a JSON array' }) as StorageProgram<Result>;
        }
        rows = parsed as Record<string, unknown>[];
      } catch {
        return complete(createProgram(), 'error', { message: 'rows is not valid JSON' }) as StorageProgram<Result>;
      }
    } else if (rowsRaw === undefined || rowsRaw === null || rowsRaw === '') {
      rows = [];
    } else {
      return complete(createProgram(), 'error', { message: 'rows must be a JSON array string' }) as StorageProgram<Result>;
    }

    const resolvedRows = rows;

    let p = createProgram();
    p = get(p, 'group', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Group spec "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;

        let config: GroupingConfig;
        try {
          const parsed = JSON.parse(rec.grouping as string);
          // Tolerate empty/partial configs
          config = {
            type: parsed.type ?? 'basic',
            fields: Array.isArray(parsed.fields) ? parsed.fields : [],
          } as GroupingConfig;
        } catch {
          return { groups: JSON.stringify([]) };
        }

        let defs: AggregationDef[] = [];
        try {
          const parsedAgg = JSON.parse(rec.aggregations as string);
          if (Array.isArray(parsedAgg)) {
            defs = parsedAgg as AggregationDef[];
          }
        } catch {
          // Aggregations optional — proceed with empty
        }

        const buckets = groupRows(resolvedRows, config, defs);
        return { groups: JSON.stringify(buckets) };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'group', {}, 'allGroups');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allGroups ?? []) as Array<Record<string, unknown>>;
      const names = all.map(g => g.name as string);
      return { groups: JSON.stringify(names) };
    }) as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'GroupSpec' }) as StorageProgram<Result>;
  },
};

export const groupSpecHandler = autoInterpret(_handler);
