/* ---------------------------------------------------------------------------
 * VariableInspector — Server Component
 *
 * Key-value inspector panel for process run variables. Displays variable
 * names, types, current values, and watch expressions.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ProcessVariable {
  name: string;
  type: string;
  value: unknown;
  scope?: string;
  changed?: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: unknown;
}

export interface VariableInspectorProps {
  /** List of process variables to display. */
  variables: ProcessVariable[];
  /** Current run status. */
  runStatus: string;
  /** Whether to show type badges. */
  showTypes?: boolean;
  /** Whether to show the watch expression panel. */
  showWatch?: boolean;
  /** Default JSON expansion depth. */
  expandDepth?: number;
  /** Watch expressions list. */
  watchExpressions?: WatchExpression[];
  /** Name of the selected variable. */
  selectedVariable?: string | undefined;
  /** Search query to filter variables. */
  searchQuery?: string;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return '{...}';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function typeBadgeLabel(type: string): string {
  const map: Record<string, string> = {
    string: 'str',
    number: 'num',
    boolean: 'bool',
    object: 'obj',
    array: 'arr',
  };
  return map[type.toLowerCase()] ?? type;
}

/* ---------------------------------------------------------------------------
 * ValueDisplay — static nested value renderer
 * ------------------------------------------------------------------------- */

function ValueDisplay({ value, depth, maxDepth }: { value: unknown; depth: number; maxDepth: number }) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return <span data-part="primitive-value">{formatValue(value, depth, maxDepth)}</span>;
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const isExpanded = depth < maxDepth;

  return (
    <div data-part="complex-value" data-expanded={isExpanded ? 'true' : 'false'}>
      <button
        type="button"
        data-part="expand-toggle"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse value' : 'Expand value'}
      >
        {isExpanded ? '\u25BC' : '\u25B6'} {Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`}
      </button>
      {isExpanded && (
        <div data-part="nested-entries" role="group">
          {entries.map(([key, val]) => (
            <div key={key} data-part="nested-entry" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
              <span data-part="entry-key">{key}: </span>
              <ValueDisplay value={val} depth={depth + 1} maxDepth={maxDepth} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function VariableInspector({
  variables,
  runStatus: _runStatus,
  showTypes = true,
  showWatch = true,
  expandDepth = 1,
  watchExpressions = [],
  selectedVariable,
  searchQuery = '',
  children,
}: VariableInspectorProps) {
  const filteredVariables = searchQuery
    ? variables.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : variables;

  const state = selectedVariable ? 'varSelected' : (searchQuery ? 'filtering' : 'idle');

  return (
    <div
      role="region"
      aria-label="Variable inspector"
      data-surface-widget=""
      data-widget-name="variable-inspector"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      {/* Search bar */}
      <div data-part="search">
        <input
          type="search"
          data-part="search-input"
          placeholder="Filter variables..."
          defaultValue={searchQuery}
          aria-label="Filter variables by name"
        />
        {searchQuery && (
          <button
            type="button"
            data-part="search-clear"
            aria-label="Clear search"
          >
            {'\u2715'}
          </button>
        )}
      </div>

      {/* Variable list */}
      <div data-part="variable-list" role="list" aria-label="Variables">
        {filteredVariables.map((variable, index) => {
          const isSelected = selectedVariable === variable.name;
          return (
            <div
              key={variable.name}
              data-part="variable-item"
              role="listitem"
              aria-label={`${variable.name}: ${formatValue(variable.value, 0, 0)}`}
              aria-selected={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              data-changed={variable.changed ? 'true' : 'false'}
              tabIndex={index === 0 ? 0 : -1}
            >
              <span data-part="var-name">{variable.name}</span>

              {showTypes && (
                <span data-part="var-type" data-type={variable.type}>
                  {typeBadgeLabel(variable.type)}
                </span>
              )}

              {variable.scope && (
                <span data-part="var-scope" aria-label={`Scope: ${variable.scope}`}>
                  {variable.scope}
                </span>
              )}

              <div data-part="var-value">
                <ValueDisplay value={variable.value} depth={0} maxDepth={expandDepth} />
              </div>

              {variable.changed && (
                <span data-part="changed-indicator" aria-label="Value changed" aria-hidden="true">
                  {'\u2022'}
                </span>
              )}
            </div>
          );
        })}
        {filteredVariables.length === 0 && (
          <div data-part="empty-state" role="status">
            {searchQuery ? 'No variables match the filter' : 'No variables available'}
          </div>
        )}
      </div>

      {/* Watch list */}
      {showWatch && (
        <div data-part="watch-list" data-visible="true">
          <div data-part="watch-header">
            <span>Watch Expressions</span>
            <button
              type="button"
              data-part="add-watch"
              aria-label="Add watch expression"
            >
              + Watch
            </button>
          </div>
          {watchExpressions.map((watch) => (
            <div key={watch.id} data-part="watch-item" role="listitem">
              <span data-part="watch-expression">{watch.expression}</span>
              <span data-part="watch-value">
                {watch.value !== undefined ? formatValue(watch.value, 0, 1) : 'evaluating...'}
              </span>
              <button
                type="button"
                data-part="remove-watch"
                aria-label={`Remove watch: ${watch.expression}`}
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

export { VariableInspector };
