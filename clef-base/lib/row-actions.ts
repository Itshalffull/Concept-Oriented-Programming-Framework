/**
 * Row action types and resolver for the View system.
 * Shared between ViewRenderer and display components (CardGridDisplay, TableDisplay).
 */

export interface RowActionConfig {
  /** Unique key for this action (used as React key) */
  key: string;
  /** Concept to invoke */
  concept: string;
  /** Action to invoke on the concept */
  action: string;
  /** Map of action param names to row field keys. e.g. {"theme": "theme"} */
  params: Record<string, string>;
  /** Static label, or conditional array for dynamic labels */
  label: string | Array<{ when: { field: string; equals: unknown }; label: string }>;
  /** Button visual variant */
  variant?: 'filled' | 'outlined' | 'ghost';
  /** Only show this action when condition is met */
  condition?: { field: string; equals: unknown } | { field: string; notEquals: unknown };
}

/** Resolve the label and visibility of a row action for a given data row */
export function resolveRowAction(
  action: RowActionConfig,
  row: Record<string, unknown>,
): { visible: boolean; label: string } {
  if (action.condition) {
    const cond = action.condition;
    if ('equals' in cond && row[cond.field] !== cond.equals) return { visible: false, label: '' };
    if ('notEquals' in cond && row[cond.field] === cond.notEquals) return { visible: false, label: '' };
  }
  let label: string;
  if (typeof action.label === 'string') {
    label = action.label;
  } else {
    const match = action.label.find(l => row[l.when.field] === l.when.equals);
    label = match?.label ?? '';
    if (!label) return { visible: false, label: '' };
  }
  return { visible: true, label };
}
