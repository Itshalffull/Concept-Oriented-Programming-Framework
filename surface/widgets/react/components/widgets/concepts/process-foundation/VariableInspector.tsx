/* ---------------------------------------------------------------------------
 * VariableInspector — Key-value inspector panel for process run variables
 *
 * Displays variable names, types, current values, and change history.
 * Supports JSON tree expansion for complex values, search/filter,
 * and watch expressions for monitoring specific variables.
 * ------------------------------------------------------------------------- */

export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH'; query?: string }
  | { type: 'SELECT_VAR'; name?: string }
  | { type: 'ADD_WATCH'; name?: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function variableInspectorReducer(state: VariableInspectorState, event: VariableInspectorEvent): VariableInspectorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      if (event.type === 'ADD_WATCH') return 'idle';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    case 'varSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

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

export interface VariableInspectorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** List of process variables to display */
  variables: ProcessVariable[];
  /** Current run status */
  runStatus: string;
  /** Whether to show type badges */
  showTypes?: boolean;
  /** Whether to show the watch expression panel */
  showWatch?: boolean;
  /** Default JSON expansion depth */
  expandDepth?: number;
  /** Watch expressions list */
  watchExpressions?: WatchExpression[];
  /** Called when a variable is selected */
  onSelectVariable?: (name: string) => void;
  /** Called when a watch expression is added */
  onAddWatch?: (expression: string) => void;
  /** Called when a watch expression is removed */
  onRemoveWatch?: (id: string) => void;
  /** Called when a variable value is edited */
  onEditValue?: (name: string, value: unknown) => void;
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
 * Nested value renderer
 * ------------------------------------------------------------------------- */

function ValueDisplay({ value, depth, maxDepth }: { value: unknown; depth: number; maxDepth: number }) {
  const [expanded, setExpanded] = useState(depth < maxDepth);

  if (value === null || value === undefined || typeof value !== 'object') {
    return <span data-part="primitive-value">{formatValue(value, depth, maxDepth)}</span>;
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div data-part="complex-value" data-expanded={expanded ? 'true' : 'false'}>
      <button
        type="button"
        data-part="expand-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse value' : 'Expand value'}
      >
        {expanded ? '\u25BC' : '\u25B6'} {Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`}
      </button>
      {expanded && (
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

const VariableInspector = forwardRef<HTMLDivElement, VariableInspectorProps>(function VariableInspector(
  {
    variables,
    runStatus,
    showTypes = true,
    showWatch = true,
    expandDepth = 1,
    watchExpressions = [],
    onSelectVariable,
    onAddWatch,
    onRemoveWatch,
    onEditValue,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(variableInspectorReducer, 'idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredVariables = useMemo(() => {
    if (!searchQuery) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }, [variables, searchQuery]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (value) {
      send({ type: 'SEARCH', query: value });
    } else {
      send({ type: 'CLEAR' });
    }
  }, []);

  const handleSelectVar = useCallback((name: string) => {
    setSelectedVar(name);
    send({ type: 'SELECT_VAR', name });
    onSelectVariable?.(name);
  }, [onSelectVariable]);

  const handleDeselect = useCallback(() => {
    setSelectedVar(null);
    send({ type: 'DESELECT' });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, filteredVariables.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const variable = filteredVariables[focusIndex];
      if (variable) handleSelectVar(variable.name);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleDeselect();
    }
  }, [filteredVariables, focusIndex, handleSelectVar, handleDeselect]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Variable inspector"
      data-surface-widget=""
      data-widget-name="variable-inspector"
      data-part="root"
      data-state={state}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Search bar */}
      <div data-part="search">
        <input
          ref={searchRef}
          type="search"
          data-part="search-input"
          placeholder="Filter variables..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          aria-label="Filter variables by name"
        />
        {searchQuery && (
          <button
            type="button"
            data-part="search-clear"
            onClick={() => handleSearch('')}
            aria-label="Clear search"
          >
            {'\u2715'}
          </button>
        )}
      </div>

      {/* Variable list */}
      <div data-part="variable-list" role="list" aria-label="Variables" ref={listRef}>
        {filteredVariables.map((variable, index) => {
          const isSelected = selectedVar === variable.name;
          const isFocused = focusIndex === index;
          return (
            <div
              key={variable.name}
              data-part="variable-item"
              role="listitem"
              aria-label={`${variable.name}: ${formatValue(variable.value, 0, 0)}`}
              aria-selected={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              data-changed={variable.changed ? 'true' : 'false'}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => handleSelectVar(variable.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectVar(variable.name);
                }
              }}
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
              onClick={() => {
                const expr = selectedVar ?? '';
                if (expr) {
                  send({ type: 'ADD_WATCH', name: expr });
                  onAddWatch?.(expr);
                }
              }}
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
                onClick={() => onRemoveWatch?.(watch.id)}
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
});

VariableInspector.displayName = 'VariableInspector';
export { VariableInspector };
export default VariableInspector;
