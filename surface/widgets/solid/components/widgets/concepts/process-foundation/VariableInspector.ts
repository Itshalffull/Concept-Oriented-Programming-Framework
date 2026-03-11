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

export interface VariableInspectorProps { [key: string]: unknown; class?: string; }
export interface VariableInspectorResult { element: HTMLElement; dispose: () => void; }

export function VariableInspector(props: VariableInspectorProps): VariableInspectorResult {
  const sig = surfaceCreateSignal<VariableInspectorState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(variableInspectorReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'variable-inspector');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Variable inspector');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Search bar */
  const searchEl = document.createElement('div');
  searchEl.setAttribute('data-part', 'search');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.placeholder = 'Filter variables...';
  searchInput.setAttribute('aria-label', 'Filter variables by name');
  searchInput.addEventListener('input', () => {
    if (searchInput.value) {
      send('SEARCH');
    } else {
      send('CLEAR');
    }
  });
  searchEl.appendChild(searchInput);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.setAttribute('data-part', 'search-clear');
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.textContent = '\u2715';
  clearBtn.style.display = 'none';
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    send('CLEAR');
  });
  searchEl.appendChild(clearBtn);
  root.appendChild(searchEl);

  /* Variable list */
  const variableListEl = document.createElement('div');
  variableListEl.setAttribute('data-part', 'variable-list');
  variableListEl.setAttribute('role', 'list');
  variableListEl.setAttribute('aria-label', 'Variables');

  /* Template variable item */
  const variableItemEl = document.createElement('div');
  variableItemEl.setAttribute('data-part', 'variable-item');
  variableItemEl.setAttribute('role', 'listitem');
  variableItemEl.setAttribute('aria-selected', 'false');
  variableItemEl.setAttribute('data-selected', 'false');
  variableItemEl.setAttribute('data-changed', 'false');
  variableItemEl.setAttribute('tabindex', '0');
  variableItemEl.style.cursor = 'pointer';
  variableItemEl.addEventListener('click', () => { send('SELECT_VAR'); });
  variableItemEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      send('SELECT_VAR');
    }
  });

  const varNameEl = document.createElement('span');
  varNameEl.setAttribute('data-part', 'var-name');
  varNameEl.textContent = 'variableName';
  variableItemEl.appendChild(varNameEl);

  const varTypeEl = document.createElement('span');
  varTypeEl.setAttribute('data-part', 'var-type');
  varTypeEl.textContent = 'str';
  variableItemEl.appendChild(varTypeEl);

  const varScopeEl = document.createElement('span');
  varScopeEl.setAttribute('data-part', 'var-scope');
  varScopeEl.textContent = 'local';
  variableItemEl.appendChild(varScopeEl);

  const varValueEl = document.createElement('div');
  varValueEl.setAttribute('data-part', 'var-value');
  const primitiveValueEl = document.createElement('span');
  primitiveValueEl.setAttribute('data-part', 'primitive-value');
  primitiveValueEl.textContent = '"value"';
  varValueEl.appendChild(primitiveValueEl);
  variableItemEl.appendChild(varValueEl);

  const changedIndicator = document.createElement('span');
  changedIndicator.setAttribute('data-part', 'changed-indicator');
  changedIndicator.setAttribute('aria-label', 'Value changed');
  changedIndicator.setAttribute('aria-hidden', 'true');
  changedIndicator.textContent = '\u2022';
  changedIndicator.style.display = 'none';
  variableItemEl.appendChild(changedIndicator);

  variableListEl.appendChild(variableItemEl);

  /* Empty state */
  const emptyStateEl = document.createElement('div');
  emptyStateEl.setAttribute('data-part', 'empty-state');
  emptyStateEl.setAttribute('role', 'status');
  emptyStateEl.textContent = 'No variables available';
  emptyStateEl.style.display = 'none';
  variableListEl.appendChild(emptyStateEl);

  root.appendChild(variableListEl);

  /* Watch list */
  const watchListEl = document.createElement('div');
  watchListEl.setAttribute('data-part', 'watch-list');
  watchListEl.setAttribute('data-visible', 'true');

  const watchHeaderEl = document.createElement('div');
  watchHeaderEl.setAttribute('data-part', 'watch-header');
  const watchTitle = document.createElement('span');
  watchTitle.textContent = 'Watch Expressions';
  watchHeaderEl.appendChild(watchTitle);
  const addWatchBtn = document.createElement('button');
  addWatchBtn.type = 'button';
  addWatchBtn.setAttribute('data-part', 'add-watch');
  addWatchBtn.setAttribute('aria-label', 'Add watch expression');
  addWatchBtn.textContent = '+ Watch';
  addWatchBtn.addEventListener('click', () => { send('ADD_WATCH'); });
  watchHeaderEl.appendChild(addWatchBtn);
  watchListEl.appendChild(watchHeaderEl);

  /* Template watch item */
  const watchItemEl = document.createElement('div');
  watchItemEl.setAttribute('data-part', 'watch-item');
  watchItemEl.setAttribute('role', 'listitem');
  const watchExprEl = document.createElement('span');
  watchExprEl.setAttribute('data-part', 'watch-expression');
  watchExprEl.textContent = 'expression';
  watchItemEl.appendChild(watchExprEl);
  const watchValueEl = document.createElement('span');
  watchValueEl.setAttribute('data-part', 'watch-value');
  watchValueEl.textContent = 'evaluating...';
  watchItemEl.appendChild(watchValueEl);
  const removeWatchBtn = document.createElement('button');
  removeWatchBtn.type = 'button';
  removeWatchBtn.setAttribute('data-part', 'remove-watch');
  removeWatchBtn.setAttribute('aria-label', 'Remove watch');
  removeWatchBtn.textContent = '\u2715';
  watchItemEl.appendChild(removeWatchBtn);
  watchListEl.appendChild(watchItemEl);

  root.appendChild(watchListEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      send('SELECT_VAR');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      send('DESELECT');
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isSelected = s === 'varSelected';
    variableItemEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
    variableItemEl.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    clearBtn.style.display = s === 'filtering' ? 'inline' : 'none';
  }));

  return {
    element: root,
    dispose() { unsubs.forEach((u) => u()); root.remove(); },
  };
}

export default VariableInspector;
