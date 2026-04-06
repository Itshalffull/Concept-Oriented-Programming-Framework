/**
 * Shared view-layer types and evaluation functions.
 *
 * Single source of truth for FilterNode, SortKey, evaluateFilterNode,
 * and applySortKeys. All three consumers (FilterSpec handler,
 * InMemoryProvider, and clef-base/lib/filter-evaluator) import from here.
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.
 */

// ─── FilterNode type hierarchy ────────────────────────────────────────────────

export type FilterNode =
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'eq'; field: string; value: unknown }
  | { type: 'neq'; field: string; value: unknown }
  | { type: 'lt'; field: string; value: unknown }
  | { type: 'lte'; field: string; value: unknown }
  | { type: 'gt'; field: string; value: unknown }
  | { type: 'gte'; field: string; value: unknown }
  | { type: 'in'; field: string; values: unknown[] }
  | { type: 'not_in'; field: string; values: unknown[] }
  | { type: 'exists'; field: string }
  | { type: 'function'; name: 'contains' | 'startsWith' | 'endsWith' | 'matches'; field: string; value: string }
  | { type: 'and'; conditions: FilterNode[] }
  | { type: 'or'; conditions: FilterNode[] }
  | { type: 'not'; condition: FilterNode }
  | { type: 'param'; name: string };

// ─── SortKey interface ────────────────────────────────────────────────────────

export interface SortKey {
  field: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last' | 'auto';
  collation?: string;
}

// ─── FilterNode evaluation ────────────────────────────────────────────────────

/**
 * Evaluate a FilterNode predicate tree against a single data row.
 * Array fields use intersection semantics for 'in' — any element match suffices.
 * Unresolved param nodes are treated as identity (true).
 */
export function evaluateFilterNode(node: FilterNode, row: Record<string, unknown>): boolean {
  switch (node.type) {
    case 'true': return true;
    case 'false': return false;

    case 'eq': return row[node.field] === node.value;
    case 'neq': return row[node.field] !== node.value;
    case 'lt': return (row[node.field] as number) < (node.value as number);
    case 'lte': return (row[node.field] as number) <= (node.value as number);
    case 'gt': return (row[node.field] as number) > (node.value as number);
    case 'gte': return (row[node.field] as number) >= (node.value as number);

    case 'in': {
      const fieldVal = row[node.field];
      // Array fields: intersection — any element of fieldVal is in values
      if (Array.isArray(fieldVal)) {
        return (fieldVal as unknown[]).some(v => node.values.includes(v));
      }
      return node.values.includes(fieldVal);
    }

    case 'not_in': {
      const fieldVal = row[node.field];
      if (Array.isArray(fieldVal)) {
        return !(fieldVal as unknown[]).some(v => node.values.includes(v));
      }
      return !node.values.includes(fieldVal);
    }

    case 'exists': {
      const v = row[node.field];
      return v !== null && v !== undefined;
    }

    case 'function': {
      const str = String(row[node.field] ?? '');
      switch (node.name) {
        case 'contains': return str.includes(node.value);
        case 'startsWith': return str.startsWith(node.value);
        case 'endsWith': return str.endsWith(node.value);
        case 'matches': return new RegExp(node.value).test(str);
      }
    }

    case 'and': return node.conditions.every(c => evaluateFilterNode(c, row));
    case 'or': return node.conditions.some(c => evaluateFilterNode(c, row));
    case 'not': return !evaluateFilterNode(node.condition, row);

    // Unresolved param: treat as identity (true)
    case 'param': return true;
  }
}

// ─── Sort evaluation ──────────────────────────────────────────────────────────

export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export function isNullish(v: unknown): boolean {
  return v === null || v === undefined;
}

/**
 * Stable multi-key sort. Per-key direction (asc/desc), null handling
 * (first/last/auto), and original-index tiebreaking for stability.
 */
export function applySortKeys(
  rows: Record<string, unknown>[],
  keys: SortKey[],
): Record<string, unknown>[] {
  if (keys.length === 0) return rows;

  // Stable sort: attach original index for tiebreaking
  const indexed = rows.map((row, idx) => ({ row, idx }));

  indexed.sort((a, b) => {
    for (const key of keys) {
      const aVal = a.row[key.field];
      const bVal = b.row[key.field];

      const aNull = isNullish(aVal);
      const bNull = isNullish(bVal);

      if (aNull || bNull) {
        if (aNull && bNull) continue;
        const nullsPos = key.nulls ?? 'auto';
        const nullsLast: boolean =
          nullsPos === 'auto' ? key.direction === 'asc' : nullsPos === 'last';
        if (aNull) return nullsLast ? 1 : -1;
        return nullsLast ? -1 : 1;
      }

      let cmp = compareValues(aVal, bVal);
      if (key.direction === 'desc') cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    // Tiebreak by original index ensures stability
    return a.idx - b.idx;
  });

  return indexed.map(({ row }) => row);
}
