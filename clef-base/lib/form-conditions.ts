/**
 * Conditional field visibility engine for form rendering.
 *
 * Supports Airtable-style field conditions where a field is shown only when
 * another field satisfies a predicate. Handles transitive (daisy-chained)
 * dependencies: if field B depends on A and A is hidden, B is also hidden.
 *
 * Conditions should only reference fields that appear BEFORE the conditional
 * field in form order — this prevents cycles and keeps evaluation deterministic.
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConditionOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'is-empty'
  | 'is-not-empty'
  | 'any-of'
  | 'greater-than'
  | 'less-than';

export interface FieldCondition {
  fieldId: string;
  showWhen: {
    field: string;
    operator: ConditionOperator;
    value?: unknown;
  };
}

// ─── isEmpty helper ───────────────────────────────────────────────────────────

function isEmpty(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

// ─── evaluateCondition ────────────────────────────────────────────────────────

/**
 * Evaluate a single showWhen condition against the current form values.
 * Returns true if the condition is satisfied (field should be shown).
 */
export function evaluateCondition(
  condition: FieldCondition['showWhen'],
  values: Record<string, unknown>,
): boolean {
  const value = values[condition.field];
  const target = condition.value;

  switch (condition.operator) {
    case 'equals': {
      // Strict equality with string coercion for numbers
      if (typeof value === 'number' || typeof target === 'number') {
        return String(value) === String(target);
      }
      return value === target;
    }

    case 'not-equals': {
      if (typeof value === 'number' || typeof target === 'number') {
        return String(value) !== String(target);
      }
      return value !== target;
    }

    case 'contains': {
      return String(value).includes(String(target));
    }

    case 'is-empty': {
      return isEmpty(value);
    }

    case 'is-not-empty': {
      return !isEmpty(value);
    }

    case 'any-of': {
      return Array.isArray(target) && target.includes(value);
    }

    case 'greater-than': {
      return Number(value) > Number(target);
    }

    case 'less-than': {
      return Number(value) < Number(target);
    }

    default: {
      return true;
    }
  }
}

// ─── getVisibleFields ─────────────────────────────────────────────────────────

/**
 * Compute the set of visible field IDs given all conditions and current form values.
 *
 * Fields not mentioned in any condition are always visible.
 * Supports daisy-chaining: if field B depends on A and A is hidden, B is also hidden,
 * even if B's own condition would otherwise be satisfied.
 *
 * Evaluation order follows allFieldIds, which must be in form field order
 * (earlier fields first) to ensure dependencies are resolved before dependants.
 */
export function getVisibleFields(
  allFieldIds: string[],
  conditions: FieldCondition[],
  values: Record<string, unknown>,
): Set<string> {
  // Build a map from fieldId -> condition for O(1) lookup
  const conditionMap = new Map<string, FieldCondition>();
  for (const c of conditions) {
    conditionMap.set(c.fieldId, c);
  }

  const visible = new Set<string>();

  for (const fieldId of allFieldIds) {
    const condition = conditionMap.get(fieldId);

    if (!condition) {
      // No condition — always visible
      visible.add(fieldId);
      continue;
    }

    // The field the condition references must itself be visible (daisy-chain)
    if (!visible.has(condition.showWhen.field)) {
      // Dependency is hidden — this field is also hidden
      continue;
    }

    // Evaluate the condition predicate
    if (evaluateCondition(condition.showWhen, values)) {
      visible.add(fieldId);
    }
  }

  return visible;
}

// ─── detectCircularConditions ─────────────────────────────────────────────────

/**
 * Validate that conditions contain no circular dependencies.
 * Returns the cycle path as an array of field IDs if a cycle exists, null if valid.
 *
 * Per the Airtable pattern, conditions should only reference fields that appear
 * before the conditional field in form order. This function detects any cycle
 * in the dependency graph regardless of order.
 */
export function detectCircularConditions(conditions: FieldCondition[]): string[] | null {
  // Build adjacency: fieldId -> field it depends on
  const deps = new Map<string, string>();
  for (const c of conditions) {
    deps.set(c.fieldId, c.showWhen.field);
  }

  // For each node, walk the dependency chain looking for a cycle
  for (const startField of deps.keys()) {
    const visited = new Set<string>();
    const path: string[] = [];
    let current: string | undefined = startField;

    while (current !== undefined) {
      if (visited.has(current)) {
        // Found a cycle — return the cycle portion of the path
        const cycleStart = path.indexOf(current);
        return path.slice(cycleStart);
      }
      visited.add(current);
      path.push(current);
      current = deps.get(current);
    }
  }

  return null;
}

// ─── parseConditions ─────────────────────────────────────────────────────────

/**
 * Parse a JSON string containing an array of FieldCondition objects.
 * Returns an empty array on invalid or missing input.
 */
export function parseConditions(conditionsJson: string): FieldCondition[] {
  if (!conditionsJson || conditionsJson.trim() === '') return [];
  try {
    const parsed = JSON.parse(conditionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed as FieldCondition[];
  } catch {
    return [];
  }
}
