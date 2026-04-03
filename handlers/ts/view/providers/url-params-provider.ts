/**
 * UrlParamsProvider — converts between URL query strings and FilterNode IR.
 *
 * Supported parse rules:
 *   - Empty string                     → { type: 'true' }
 *   - field=a,b,c (multiple values)    → { type: 'in', field, values }
 *   - field=v (single value)           → { type: 'comparison', field, op: 'eq', value }
 *   - field__gt=5                      → { type: 'comparison', field, op: 'gt', value: 5 }
 *   - Multiple parameters              → AND of all per-field nodes
 *
 * Supported operator suffixes: __gt, __gte, __lt, __lte, __neq, __contains, __startsWith
 *
 * Supported print rules:
 *   - { type: 'true' }                 → ""
 *   - { type: 'comparison', op: 'eq' } → field=value
 *   - { type: 'comparison', op: X }    → field__X=value
 *   - { type: 'in' }                   → field=val1,val2
 *   - { type: 'and' }                  → join children with &
 *   - Anything else                    → null (unsupported)
 *
 * See FilterNode type in clef-base/lib/filter-evaluator.ts
 */

// Inline FilterNode to avoid cross-package import from handlers/
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

// FilterNode subtype used exclusively by this provider
type ComparisonNode =
  | { type: 'eq'; field: string; value: unknown }
  | { type: 'neq'; field: string; value: unknown }
  | { type: 'lt'; field: string; value: unknown }
  | { type: 'lte'; field: string; value: unknown }
  | { type: 'gt'; field: string; value: unknown }
  | { type: 'gte'; field: string; value: unknown };

type ComparisonOp = ComparisonNode['type'];

// Maps op suffix strings to FilterNode types
const SUFFIX_TO_OP: Record<string, ComparisonOp> = {
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  neq: 'neq',
};

// Maps op to suffix (for printing); 'contains' and 'startsWith' go via function nodes
const OP_TO_SUFFIX: Record<ComparisonOp, string | null> = {
  eq: null,
  neq: '__neq',
  gt: '__gt',
  gte: '__gte',
  lt: '__lt',
  lte: '__lte',
};

const FUNCTION_OPS = new Set(['contains', 'startsWith']);

/**
 * Coerce a raw string value to a number if it looks numeric, otherwise keep it as a string.
 */
function coerceValue(raw: string): unknown {
  if (raw === '') return raw;
  const n = Number(raw);
  if (!Number.isNaN(n) && raw.trim() !== '') return n;
  return raw;
}

/**
 * Parse a URL query string (without the leading `?`) into a FilterNode AND-tree.
 */
export function parse(repr: string): FilterNode {
  if (!repr || repr.trim() === '') return { type: 'true' };

  const nodes: FilterNode[] = [];

  // Use URLSearchParams for correct percent-decoding and multi-value handling
  const params = new URLSearchParams(repr);

  for (const [rawKey, rawValue] of params.entries()) {
    // Check for operator suffix: field__op=value
    const doubleUnderIdx = rawKey.lastIndexOf('__');
    if (doubleUnderIdx !== -1) {
      const suffix = rawKey.slice(doubleUnderIdx + 2);
      const field = rawKey.slice(0, doubleUnderIdx);

      if (SUFFIX_TO_OP[suffix] !== undefined) {
        const op = SUFFIX_TO_OP[suffix];
        nodes.push({ type: op, field, value: coerceValue(rawValue) } as FilterNode);
        continue;
      }

      if (suffix === 'contains' || suffix === 'startsWith') {
        nodes.push({ type: 'function', name: suffix as 'contains' | 'startsWith', field, value: rawValue });
        continue;
      }
    }

    // No operator suffix — comma-separated multi-value or single value
    const values = rawValue.split(',').map(v => coerceValue(v));
    if (values.length > 1) {
      nodes.push({ type: 'in', field: rawKey, values });
    } else {
      nodes.push({ type: 'eq', field: rawKey, value: values[0] } as FilterNode);
    }
  }

  if (nodes.length === 0) return { type: 'true' };
  if (nodes.length === 1) return nodes[0];
  return { type: 'and', conditions: nodes };
}

/**
 * Print a FilterNode as a URL query string, or null if the node cannot be represented.
 */
export function print(node: FilterNode): string | null {
  switch (node.type) {
    case 'true':
      return '';

    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const suffix = OP_TO_SUFFIX[node.type as ComparisonOp];
      const key = suffix ? `${node.field}${suffix}` : node.field;
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(node.value))}`;
    }

    case 'in': {
      if (node.values.length === 0) return null;
      const encoded = node.values.map(v => encodeURIComponent(String(v))).join(',');
      return `${encodeURIComponent(node.field)}=${encoded}`;
    }

    case 'function': {
      if (!FUNCTION_OPS.has(node.name)) return null;
      const key = `${node.field}__${node.name}`;
      return `${encodeURIComponent(key)}=${encodeURIComponent(node.value)}`;
    }

    case 'and': {
      const parts: string[] = [];
      for (const child of node.conditions) {
        const p = print(child);
        if (p === null) return null;
        if (p !== '') parts.push(p);
      }
      return parts.join('&');
    }

    // OR, NOT, false, not_in, exists, param — not representable as flat URL params
    default:
      return null;
  }
}

/**
 * Returns true if print() would succeed (return a non-null string) for this node.
 */
export function canPrint(node: FilterNode): boolean {
  return print(node) !== null;
}

export const kind = 'url-params' as const;
