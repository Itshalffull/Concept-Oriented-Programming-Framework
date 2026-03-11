import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT_VAR' }
  | { type: 'ADD_WATCH' }
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

/* --- Types --- */

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
  [key: string]: unknown;
  class?: string;
  variables: ProcessVariable[];
  runStatus: string;
  showTypes?: boolean;
  showWatch?: boolean;
  expandDepth?: number;
  watchExpressions?: WatchExpression[];
  onSelectVariable?: (name: string) => void;
  onAddWatch?: (expression: string) => void;
  onRemoveWatch?: (id: string) => void;
}
export interface VariableInspectorResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

function formatValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return '{...}';
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function typeBadgeLabel(type: string): string {
  const map: Record<string, string> = { string: 'str', number: 'num', boolean: 'bool', object: 'obj', array: 'arr' };
  return map[type.toLowerCase()] ?? type;
}

/* --- Component --- */

export function VariableInspector(props: VariableInspectorProps): VariableInspectorResult {
  const sig = surfaceCreateSignal<VariableInspectorState>('idle');
  const send = (type: string) => sig.set(variableInspectorReducer(sig.get(), { type } as any));

  const variables = (props.variables ?? []) as ProcessVariable[];
  const showTypes = props.showTypes !== false;
  const showWatch = props.showWatch !== false;
  const expandDepth = (props.expandDepth as number) ?? 1;
  const watchExpressions = (props.watchExpressions ?? []) as WatchExpression[];
  const onSelectVariable = props.onSelectVariable as ((name: string) => void) | undefined;
  const onAddWatch = props.onAddWatch as ((expr: string) => void) | undefined;
  const onRemoveWatch = props.onRemoveWatch as ((id: string) => void) | undefined;

  let searchQuery = '';
  let selectedVar: string | null = null;
  let focusIndex = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'variable-inspector');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Variable inspector');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Search bar
  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-part', 'search');
  root.appendChild(searchDiv);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.placeholder = 'Filter variables...';
  searchInput.setAttribute('aria-label', 'Filter variables by name');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchQuery) send('SEARCH');
    else send('CLEAR');
    rebuildList();
  });
  searchDiv.appendChild(searchInput);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.setAttribute('data-part', 'search-clear');
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.textContent = '\u2715';
  clearBtn.style.display = 'none';
  clearBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    send('CLEAR');
    rebuildList();
  });
  searchDiv.appendChild(clearBtn);

  // Variable list
  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'variable-list');
  listEl.setAttribute('role', 'list');
  listEl.setAttribute('aria-label', 'Variables');
  root.appendChild(listEl);

  function getFiltered(): ProcessVariable[] {
    if (!searchQuery) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }

  function rebuildList() {
    listEl.innerHTML = '';
    clearBtn.style.display = searchQuery ? '' : 'none';
    const filtered = getFiltered();

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.setAttribute('data-part', 'empty-state');
      emptyDiv.setAttribute('role', 'status');
      emptyDiv.textContent = searchQuery ? 'No variables match the filter' : 'No variables available';
      listEl.appendChild(emptyDiv);
      return;
    }

    for (let i = 0; i < filtered.length; i++) {
      const variable = filtered[i];
      const isSelected = selectedVar === variable.name;
      const isFocused = focusIndex === i;

      const item = document.createElement('div');
      item.setAttribute('data-part', 'variable-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `${variable.name}: ${formatValue(variable.value, 0, 0)}`);
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.setAttribute('data-selected', isSelected ? 'true' : 'false');
      item.setAttribute('data-changed', variable.changed ? 'true' : 'false');
      item.setAttribute('tabindex', isFocused ? '0' : '-1');

      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('data-part', 'var-name');
      nameSpan.textContent = variable.name;
      item.appendChild(nameSpan);

      if (showTypes) {
        const typeSpan = document.createElement('span');
        typeSpan.setAttribute('data-part', 'var-type');
        typeSpan.setAttribute('data-type', variable.type);
        typeSpan.textContent = typeBadgeLabel(variable.type);
        item.appendChild(typeSpan);
      }

      if (variable.scope) {
        const scopeSpan = document.createElement('span');
        scopeSpan.setAttribute('data-part', 'var-scope');
        scopeSpan.setAttribute('aria-label', `Scope: ${variable.scope}`);
        scopeSpan.textContent = variable.scope;
        item.appendChild(scopeSpan);
      }

      const valueDiv = document.createElement('div');
      valueDiv.setAttribute('data-part', 'var-value');
      valueDiv.textContent = formatValue(variable.value, 0, expandDepth);
      item.appendChild(valueDiv);

      if (variable.changed) {
        const changedSpan = document.createElement('span');
        changedSpan.setAttribute('data-part', 'changed-indicator');
        changedSpan.setAttribute('aria-label', 'Value changed');
        changedSpan.setAttribute('aria-hidden', 'true');
        changedSpan.textContent = '\u2022';
        item.appendChild(changedSpan);
      }

      item.addEventListener('click', () => {
        selectedVar = variable.name;
        send('SELECT_VAR');
        onSelectVariable?.(variable.name);
        rebuildList();
      });

      listEl.appendChild(item);
    }
  }

  rebuildList();

  // Watch list
  const watchDiv = document.createElement('div');
  watchDiv.setAttribute('data-part', 'watch-list');
  watchDiv.setAttribute('data-visible', 'true');
  if (showWatch) root.appendChild(watchDiv);

  function rebuildWatch() {
    watchDiv.innerHTML = '';

    const headerDiv = document.createElement('div');
    headerDiv.setAttribute('data-part', 'watch-header');

    const headerSpan = document.createElement('span');
    headerSpan.textContent = 'Watch Expressions';
    headerDiv.appendChild(headerSpan);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.setAttribute('data-part', 'add-watch');
    addBtn.setAttribute('aria-label', 'Add watch expression');
    addBtn.textContent = '+ Watch';
    addBtn.addEventListener('click', () => {
      const expr = selectedVar ?? '';
      if (expr) {
        send('ADD_WATCH');
        onAddWatch?.(expr);
      }
    });
    headerDiv.appendChild(addBtn);
    watchDiv.appendChild(headerDiv);

    for (const watch of watchExpressions) {
      const watchItem = document.createElement('div');
      watchItem.setAttribute('data-part', 'watch-item');
      watchItem.setAttribute('role', 'listitem');

      const exprSpan = document.createElement('span');
      exprSpan.setAttribute('data-part', 'watch-expression');
      exprSpan.textContent = watch.expression;
      watchItem.appendChild(exprSpan);

      const valSpan = document.createElement('span');
      valSpan.setAttribute('data-part', 'watch-value');
      valSpan.textContent = watch.value !== undefined ? formatValue(watch.value, 0, 1) : 'evaluating...';
      watchItem.appendChild(valSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('data-part', 'remove-watch');
      removeBtn.setAttribute('aria-label', `Remove watch: ${watch.expression}`);
      removeBtn.textContent = '\u2715';
      removeBtn.addEventListener('click', () => onRemoveWatch?.(watch.id));
      watchItem.appendChild(removeBtn);

      watchDiv.appendChild(watchItem);
    }
  }

  if (showWatch) rebuildWatch();

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      return;
    }
    const filtered = getFiltered();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex = Math.min(focusIndex + 1, filtered.length - 1);
      rebuildList();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex = Math.max(focusIndex - 1, 0);
      rebuildList();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const variable = filtered[focusIndex];
      if (variable) {
        selectedVar = variable.name;
        send('SELECT_VAR');
        onSelectVariable?.(variable.name);
        rebuildList();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      selectedVar = null;
      send('DESELECT');
      rebuildList();
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default VariableInspector;
