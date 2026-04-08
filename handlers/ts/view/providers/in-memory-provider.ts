/**
 * InMemoryProvider — full client-side evaluation of QueryProgram instructions.
 *
 * Unlike KernelQueryProvider which delegates scan to a concept action, this
 * provider expects data to already be in the program (inline data source).
 * All instructions are evaluated locally in a single pass.
 *
 * Supported capabilities: filter, sort, group, project, limit.
 *
 * Instruction pipeline (applied in order):
 *   scan      — extract inline rows from source config
 *   filter    — apply FilterNode predicate tree
 *   sort      — apply SortKey[] multi-key stable sort
 *   group     — cluster rows into buckets with aggregations
 *   project   — select declared fields (visible === false excluded)
 *   limit     — slice by count and offset
 *
 * planPushdown: everything is pushdown — all instructions are handled locally,
 * residual program is always empty.
 *
 * Export shape:
 *   { name: "in-memory", kind: "in-memory", capabilities: [...], execute, planPushdown }
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.
 */

export type { FilterNode, SortKey } from '../types.ts';
import { evaluateFilterNode, applySortKeys } from '../types.ts';

// ─── GroupSpec ─────────────────────────────────────────────────────────────────

export interface GroupingField {
  field: string;
  sort?: 'asc' | 'desc';
}

export interface GroupingConfig {
  type?: 'basic';
  fields: GroupingField[];
}

export interface AggregationDef {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'array_agg';
  field?: string;
  alias: string;
}

export interface GroupSpec {
  grouping: GroupingConfig;
  aggregations?: AggregationDef[];
}

export interface GroupBucket {
  key: Record<string, unknown>;
  rows: Record<string, unknown>[];
  aggregates: Record<string, unknown>;
}

// ─── ProjectionField ──────────────────────────────────────────────────────────

export interface ProjectionField {
  key: string;
  label?: string;
  visible?: boolean;
  formatter?: string;
  computed?: string;
  weight?: number;
}

// ─── QueryProgram types ───────────────────────────────────────────────────────

/** Source config for inline data — rows are embedded directly. */
export interface InlineSourceConfig {
  kind: 'inline';
  rows: Record<string, unknown>[];
}

export type ScanInstruction = {
  type: 'scan';
  source: InlineSourceConfig | Record<string, unknown>;
};

export type FilterInstruction = {
  type: 'filter';
  filter: FilterNode;
};

export type SortInstruction = {
  type: 'sort';
  keys: SortKey[];
};

export type GroupInstruction = {
  type: 'group';
  spec: GroupSpec;
};

export type ProjectInstruction = {
  type: 'project';
  fields: ProjectionField[];
};

export type LimitInstruction = {
  type: 'limit';
  count?: number;
  offset?: number;
};

export type OffsetInstruction = {
  type: 'offset';
  count: number;
  bindAs?: string;
};

export type QueryInstruction =
  | ScanInstruction
  | FilterInstruction
  | SortInstruction
  | GroupInstruction
  | ProjectInstruction
  | LimitInstruction
  | OffsetInstruction;

/** A QueryProgram is an ordered list of instructions describing a data retrieval plan. */
export interface QueryProgram {
  instructions: QueryInstruction[];
}

// ─── Provider capability type ─────────────────────────────────────────────────

export type ProviderCapability = 'filter' | 'sort' | 'group' | 'project' | 'limit' | 'offset';

export interface PushdownPlan {
  /** Instructions absorbed by this provider — no further evaluation needed. */
  pushdown: QueryInstruction[];
  /** Instructions not handled — must be evaluated by the caller. */
  residual: QueryInstruction[];
}

// ─── Group evaluation ─────────────────────────────────────────────────────────

function buildGroupKey(row: Record<string, unknown>, fields: GroupingField[]): string {
  const parts: unknown[] = fields.map(f => {
    const val = row[f.field];
    return Array.isArray(val) ? (val as unknown[]).slice().sort().join(',') : val;
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
        result[def.alias] = rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
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
        result[def.alias] = vals.length > 0
          ? vals.reduce((a, b) => (a as number) < (b as number) ? a : b)
          : null;
        break;
      }
      case 'max': {
        const field = def.field;
        if (!field || rows.length === 0) { result[def.alias] = null; break; }
        const vals = rows.map(r => r[field]).filter(v => v !== null && v !== undefined);
        result[def.alias] = vals.length > 0
          ? vals.reduce((a, b) => (a as number) > (b as number) ? a : b)
          : null;
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
  spec: GroupSpec,
): GroupBucket[] {
  const fields = spec.grouping.fields;
  const defs = spec.aggregations ?? [];

  const bucketMap = new Map<string, { key: Record<string, unknown>; rows: Record<string, unknown>[] }>();

  for (const row of rows) {
    const keyStr = buildGroupKey(row, fields);
    if (!bucketMap.has(keyStr)) {
      bucketMap.set(keyStr, { key: buildKeyObject(row, fields), rows: [] });
    }
    bucketMap.get(keyStr)!.rows.push(row);
  }

  // Sort buckets by first grouping field (if sort specified)
  const buckets = Array.from(bucketMap.values());
  const firstField = fields[0];
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

// ─── Projection evaluation ────────────────────────────────────────────────────

function projectRow(
  row: Record<string, unknown>,
  fields: ProjectionField[],
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.visible === false) continue;
    projected[field.key] = row[field.key];
  }
  return projected;
}

// ─── Row type ─────────────────────────────────────────────────────────────────

/**
 * A row can be either a plain record or a GroupBucket produced by a group instruction.
 * Once a group instruction runs, downstream instructions operate on GroupBucket arrays.
 */
type Row = Record<string, unknown>;

// ─── execute ──────────────────────────────────────────────────────────────────

/**
 * Execute a QueryProgram against inline data rows.
 *
 * Takes a QueryProgram and an optional initial data array. Applies each
 * instruction in order:
 *
 *   scan    — extract inline data from source config (or use provided data)
 *   filter  — apply FilterNode evaluation
 *   sort    — apply SortKey[] multi-key stable sort
 *   group   — cluster rows into GroupBucket[] with aggregations
 *   project — select declared fields (visible === false excluded)
 *   limit   — slice rows by count/offset
 *
 * After a group instruction, rows become GroupBucket objects. Subsequent
 * filter/sort/project instructions operate on the bucket array treating
 * each bucket as a row.
 *
 * Returns the resulting rows (or GroupBuckets after grouping).
 */
export function execute(
  program: QueryProgram,
  data: Record<string, unknown>[] = [],
): Row[] {
  if (!program.instructions || program.instructions.length === 0) {
    return [];
  }

  let rows: Row[] = data;
  let grouped: GroupBucket[] | null = null;

  for (const instruction of program.instructions) {
    switch (instruction.type) {
      case 'scan': {
        const sourceConfig = instruction.source as Record<string, unknown>;
        if (sourceConfig && sourceConfig.kind === 'inline' && Array.isArray(sourceConfig.rows)) {
          rows = sourceConfig.rows as Row[];
        } else {
          // Non-inline source — use data passed in (no-op if already set)
          rows = data;
        }
        grouped = null;
        break;
      }

      case 'filter': {
        if (grouped !== null) {
          // After grouping, filter operates on bucket keys/aggregates as a flat row
          grouped = grouped.filter(bucket => {
            const bucketRow: Row = { ...bucket.key, ...bucket.aggregates };
            return evaluateFilterNode(instruction.filter, bucketRow);
          });
        } else {
          rows = rows.filter(row => evaluateFilterNode(instruction.filter, row));
        }
        break;
      }

      case 'sort': {
        if (grouped !== null) {
          // Sort buckets by treating key fields as row fields
          const bucketRows = grouped.map(b => ({ ...b.key, ...b.aggregates, __bucket: b }));
          const sorted = applySortKeys(bucketRows, instruction.keys);
          grouped = sorted.map(r => r.__bucket as GroupBucket);
        } else {
          rows = applySortKeys(rows, instruction.keys);
        }
        break;
      }

      case 'group': {
        grouped = groupRows(rows, instruction.spec);
        // After grouping, rows is semantically replaced by grouped buckets
        break;
      }

      case 'project': {
        if (grouped !== null) {
          // Project the bucket key fields
          grouped = grouped.map(bucket => ({
            ...bucket,
            key: projectRow(bucket.key, instruction.fields),
          }));
        } else {
          rows = rows.map(row => projectRow(row, instruction.fields));
        }
        break;
      }

      case 'limit': {
        const offset = instruction.offset ?? 0;
        const count = instruction.count;
        if (grouped !== null) {
          const sliced = grouped.slice(offset);
          grouped = count !== undefined ? sliced.slice(0, count) : sliced;
        } else {
          const sliced = rows.slice(offset);
          rows = count !== undefined ? sliced.slice(0, count) : sliced;
        }
        break;
      }

      case 'offset': {
        const count = instruction.count ?? 0;
        if (grouped !== null) {
          grouped = grouped.slice(count);
        } else {
          rows = rows.slice(count);
        }
        break;
      }
    }
  }

  // If grouping was performed, return the buckets as the result rows
  if (grouped !== null) {
    return grouped as unknown as Row[];
  }

  return rows;
}

// ─── planPushdown ─────────────────────────────────────────────────────────────

/**
 * Classify all instructions as pushdown — InMemoryProvider handles everything locally.
 * The residual is always empty.
 */
export function planPushdown(program: QueryProgram): PushdownPlan {
  return {
    pushdown: program.instructions ?? [],
    residual: [],
  };
}

// ─── Provider export ──────────────────────────────────────────────────────────

export const name = 'in-memory' as const;
export const kind = 'in-memory' as const;
export const capabilities: ProviderCapability[] = ['filter', 'sort', 'group', 'project', 'limit', 'offset'];

export const inMemoryProvider = {
  name,
  kind,
  capabilities,
  execute,
  planPushdown,
} as const;

export default inMemoryProvider;
