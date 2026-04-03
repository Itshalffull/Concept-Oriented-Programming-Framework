/**
 * ToggleGroupProvider — converts between toggle-group filter UI state and
 * FilterNode IR.
 *
 * The toggle-group representation is a JSON object mapping field names to
 * arrays of active string values:
 *   { "schemas": ["Concept", "Sync"], "status": ["open"] }
 *
 * This maps onto an AND-tree of IN-nodes in the FilterNode IR. Only this
 * restricted subset of FilterNode trees can round-trip through this provider.
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for filter patterns.
 */

import type { FilterNode } from '../../../../clef-base/lib/filter-evaluator.js';

export type { FilterNode };

/**
 * Parse a toggle-group representation string into a FilterNode tree.
 *
 * Input is a JSON object mapping field names to arrays of active values.
 * - Empty object → { type: "true" }
 * - Single field  → { type: "in", field, values }
 * - Multiple fields → { type: "and", conditions: [...in nodes] }
 *
 * Throws a SyntaxError if the input is not valid JSON.
 * Fields with empty value arrays are ignored (treated as no active filter).
 */
export function parse(repr: string): FilterNode {
  const raw = JSON.parse(repr) as Record<string, unknown>;

  const conditions: FilterNode[] = [];

  for (const [field, vals] of Object.entries(raw)) {
    if (!Array.isArray(vals) || vals.length === 0) continue;
    conditions.push({ type: 'in', field, values: vals as string[] });
  }

  if (conditions.length === 0) return { type: 'true' };
  if (conditions.length === 1) return conditions[0];
  return { type: 'and', conditions };
}

/**
 * Print a FilterNode tree back into a toggle-group representation string.
 *
 * Supports only: { type: "true" }, { type: "in" }, and { type: "and" }
 * nodes whose every condition is an { type: "in" } node.
 *
 * Returns null for unsupported trees (OR, NOT, comparison, function, param,
 * false, nested AND, and-of-non-in, etc.).
 */
export function print(node: FilterNode): string | null {
  if (node.type === 'true') return JSON.stringify({});

  if (node.type === 'in') {
    return JSON.stringify({ [node.field]: node.values });
  }

  if (node.type === 'and') {
    const result: Record<string, unknown[]> = {};
    for (const cond of node.conditions) {
      if (cond.type !== 'in') return null;
      result[cond.field] = cond.values;
    }
    return JSON.stringify(result);
  }

  return null;
}

/**
 * Returns true if print() would return a non-null string for this node.
 *
 * A node is printable when it is:
 * - { type: "true" }
 * - { type: "in" }
 * - { type: "and" } whose every condition is { type: "in" }
 */
export function canPrint(node: FilterNode): boolean {
  if (node.type === 'true') return true;
  if (node.type === 'in') return true;
  if (node.type === 'and') {
    return node.conditions.every(c => c.type === 'in');
  }
  return false;
}

export const kind = 'toggle-group' as const;
