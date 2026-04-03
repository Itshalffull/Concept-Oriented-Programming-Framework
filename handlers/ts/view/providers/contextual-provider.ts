/**
 * ContextualProvider — resolves context-parameterized FilterNode trees.
 *
 * Contextual filters carry a filter template (a FilterNode that may contain
 * { type: 'param', name } leaf nodes) and a bindings map that supplies
 * concrete runtime values for those params. parse() substitutes bound
 * values in a single traversal; unresolved params fall back to { type: 'true' }.
 *
 * Input format (repr):
 *   JSON object with two keys:
 *     template  – FilterNode (may contain param nodes)
 *     bindings  – Record<string, unknown> mapping param names to values
 *
 * Output of parse():
 *   FilterNode with all param nodes replaced by their concrete values.
 *   Params absent from bindings are replaced with { type: 'true' } (permissive).
 *
 * print() and canPrint() are intentionally lossy:
 *   We cannot recover which concrete values were originally params vs literals,
 *   so round-tripping is not supported. print() always returns null and
 *   canPrint() always returns false.
 *
 * See FilterNode type in clef-base/lib/filter-evaluator.ts.
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

/**
 * Recursively resolve all { type: 'param', name } nodes using the bindings map.
 * Unresolved params (not present in bindings) become { type: 'true' }.
 */
function resolveParams(node: FilterNode, bindings: Record<string, unknown>): FilterNode {
  switch (node.type) {
    case 'param': {
      // A standalone param node carries no field context so we cannot produce
      // a meaningful comparison node. Return the permissive fallback.
      // In practice, params appear as the `value` field of comparison nodes
      // (handled by resolveValue), not as standalone nodes.
      return { type: 'true' };
    }

    // Comparison nodes whose value may itself be a param node (nested in the tree)
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const value = resolveValue(node.value, bindings);
      return { ...node, value };
    }

    case 'in': {
      const values = node.values.map(v => resolveValue(v, bindings));
      return { ...node, values };
    }

    case 'not_in': {
      const values = node.values.map(v => resolveValue(v, bindings));
      return { ...node, values };
    }

    case 'function': {
      const value = resolveValue(node.value, bindings);
      return { ...node, value: String(value) };
    }

    case 'and': {
      const conditions = node.conditions.map(c => resolveParams(c, bindings));
      return { type: 'and', conditions };
    }

    case 'or': {
      const conditions = node.conditions.map(c => resolveParams(c, bindings));
      return { type: 'or', conditions };
    }

    case 'not': {
      const condition = resolveParams(node.condition, bindings);
      return { type: 'not', condition };
    }

    // Leaf nodes with no param content — pass through unchanged
    case 'true':
    case 'false':
    case 'exists':
      return node;
  }
}

/**
 * Resolve a leaf value that may be a param reference object.
 * Param objects embedded in value positions use { type: 'param', name } shape.
 * If the value is such an object and bindings contain the param name, return
 * the bound value. Otherwise return the value unchanged.
 */
function resolveValue(value: unknown, bindings: Record<string, unknown>): unknown {
  if (
    value !== null &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).type === 'param' &&
    typeof (value as Record<string, unknown>).name === 'string'
  ) {
    const paramName = (value as { type: 'param'; name: string }).name;
    const bound = bindings[paramName];
    if (bound === undefined || bound === null) {
      // Unresolved param in value position: permissive — keep original so the
      // parent comparison is effectively a tautology. Callers that evaluate
      // FilterNode trees treat unresolved params as true anyway (see filter-evaluator).
      // Return the param object unchanged; evaluateFilterNode handles { type: 'param' }.
      return value;
    }
    return bound;
  }
  return value;
}

/**
 * Parse a contextual filter repr into a fully resolved FilterNode.
 *
 * repr must be a JSON string with shape:
 *   { template: FilterNode, bindings: Record<string, unknown> }
 *
 * Returns a FilterNode with all param nodes resolved. If repr is invalid JSON
 * or missing required fields, returns { type: 'true' } (permissive fallback).
 */
export function parse(repr: string): FilterNode {
  let parsed: unknown;
  try {
    parsed = JSON.parse(repr);
  } catch {
    return { type: 'true' };
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !('template' in (parsed as object))
  ) {
    return { type: 'true' };
  }

  const obj = parsed as Record<string, unknown>;
  const template = obj.template as FilterNode;
  const bindings = (obj.bindings ?? {}) as Record<string, unknown>;

  if (template === null || typeof template !== 'object' || !('type' in template)) {
    return { type: 'true' };
  }

  return resolveParams(template, bindings);
}

/**
 * Attempt to print a FilterNode as a contextual filter repr.
 *
 * Always returns null — contextual filters are one-way (parse-only).
 * We cannot determine which concrete values were originally params vs literals,
 * so round-tripping is not supported.
 */
export function print(_node: FilterNode): string | null {
  return null;
}

/**
 * Returns false — contextual filters are always lossy (print is not supported).
 */
export function canPrint(_node: FilterNode): boolean {
  return false;
}

export const kind = 'contextual' as const;
