/**
 * Pure filter and sort evaluation functions for ViewRenderer.
 * Used directly in ViewRenderer to avoid kernel invoke roundtrips
 * for ephemeral, interactive filter/sort state.
 *
 * FilterNode, SortKey, evaluateFilterNode, and applySortKeys are re-exported
 * from the canonical shared module at handlers/ts/view/types.ts.
 * clef-base-specific helpers (buildFilterTree, buildSchemaFilterNode,
 * parseSortKeys) remain here.
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.
 */

export type { FilterNode, SortKey } from '../../handlers/ts/view/types';
export { evaluateFilterNode, applySortKeys } from '../../handlers/ts/view/types';

/**
 * Build a FilterNode tree from activeFilters state (Record<field, Set<values>>).
 * Each field becomes an 'in' node; all fields are AND-ed together.
 * For fields with no active values, produces a 'false' node (nothing matches).
 */
export function buildFilterTree(
  activeFilters: Record<string, Set<string>>,
  filterConfigs: Array<{ field: string }>,
): FilterNode {
  const conditions: FilterNode[] = [];

  for (const config of filterConfigs) {
    const active = activeFilters[config.field];
    if (!active) continue;
    if (active.size === 0) {
      // No values selected — nothing matches
      return { type: 'false' };
    }
    conditions.push({
      type: 'in',
      field: config.field,
      values: [...active],
    });
  }

  if (conditions.length === 0) return { type: 'true' };
  if (conditions.length === 1) return conditions[0];
  return { type: 'and', conditions };
}

/**
 * Build a FilterNode for schemaFilter — a single 'in' node on the schemas field.
 * The 'in' node with array intersection semantics handles multi-schema entities correctly.
 */
export function buildSchemaFilterNode(schemaFilter: string): FilterNode {
  return { type: 'in', field: 'schemas', values: [schemaFilter] };
}

/**
 * Parse a sorts config string (JSON array of SortKey) safely.
 * Returns empty array on invalid input.
 */
export function parseSortKeys(sortsJson: string | undefined): SortKey[] {
  if (!sortsJson) return [];
  try {
    const parsed = JSON.parse(sortsJson);
    if (Array.isArray(parsed)) return parsed as SortKey[];
    return [];
  } catch {
    return [];
  }
}
