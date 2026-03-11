import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent =
  | { type: 'SWITCH_TAB' }
  | { type: 'SEARCH' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' }
  | { type: 'DELETE' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' };

export function memoryInspectorReducer(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SWITCH_TAB') return 'viewing';
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'searching':
      if (event.type === 'CLEAR') return 'viewing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      if (event.type === 'DELETE') return 'deleting';
      return state;
    case 'deleting':
      if (event.type === 'CONFIRM') return 'viewing';
      if (event.type === 'CANCEL') return 'entrySelected';
      return state;
    default:
      return state;
  }
}

export interface MemoryInspectorProps { [key: string]: unknown; class?: string; }
export interface MemoryInspectorResult { element: HTMLElement; dispose: () => void; }

export function MemoryInspector(props: MemoryInspectorProps): MemoryInspectorResult {
  const sig = surfaceCreateSignal<MemoryInspectorState>('viewing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(memoryInspectorReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'memory-inspector');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Memory inspector');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInputEl.focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'deleting') send('CANCEL');
      else if (s === 'entrySelected') send('DESELECT');
      else if (s === 'searching') send('CLEAR');
    }
    if (e.key === 'Delete' && sig.get() === 'entrySelected') {
      e.preventDefault();
      send('DELETE');
    }
  });

  const tabsEl = document.createElement('div');
  tabsEl.setAttribute('data-part', 'tabs');
  tabsEl.setAttribute('role', 'tablist');
  tabsEl.setAttribute('aria-label', 'Memory types');
  root.appendChild(tabsEl);

  const tabNames = ['working', 'episodic', 'semantic', 'procedural'];
  const tabLabels: Record<string, string> = { working: 'Working', episodic: 'Episodic', semantic: 'Semantic', procedural: 'Procedural' };
  for (const tab of tabNames) {
    const tabBtn = document.createElement('button');
    tabBtn.setAttribute('type', 'button');
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('data-part', 'tab');
    tabBtn.setAttribute('data-tab', tab);
    tabBtn.setAttribute('tabindex', '-1');
    tabBtn.textContent = tabLabels[tab];
    tabBtn.addEventListener('click', () => send('SWITCH_TAB'));
    tabsEl.appendChild(tabBtn);
  }

  const searchBarEl = document.createElement('div');
  searchBarEl.setAttribute('data-part', 'search-bar');
  root.appendChild(searchBarEl);

  const searchInputEl = document.createElement('input');
  searchInputEl.setAttribute('type', 'text');
  searchInputEl.setAttribute('role', 'searchbox');
  searchInputEl.setAttribute('aria-label', 'Search memories');
  searchInputEl.setAttribute('placeholder', 'Search memories...');
  searchInputEl.setAttribute('data-part', 'search-input');
  searchInputEl.addEventListener('input', () => {
    const value = searchInputEl.value;
    if (value.trim()) {
      if (sig.get() !== 'searching') send('SEARCH');
    } else {
      if (sig.get() === 'searching') send('CLEAR');
    }
  });
  searchBarEl.appendChild(searchInputEl);

  const contextBarEl = document.createElement('div');
  contextBarEl.setAttribute('data-part', 'context-bar');
  contextBarEl.setAttribute('data-visible', 'true');
  contextBarEl.setAttribute('role', 'img');
  contextBarEl.setAttribute('aria-label', 'Token usage');
  root.appendChild(contextBarEl);

  const workingViewEl = document.createElement('div');
  workingViewEl.setAttribute('data-part', 'working-view');
  workingViewEl.setAttribute('role', 'list');
  root.appendChild(workingViewEl);

  const entryItemEl = document.createElement('div');
  entryItemEl.setAttribute('data-part', 'entry-item');
  entryItemEl.setAttribute('role', 'listitem');
  entryItemEl.setAttribute('tabindex', '-1');
  entryItemEl.addEventListener('click', () => send('SELECT_ENTRY'));
  workingViewEl.appendChild(entryItemEl);

  const entryLabelEl = document.createElement('span');
  entryLabelEl.setAttribute('data-part', 'entry-label');
  entryItemEl.appendChild(entryLabelEl);

  const entryContentEl = document.createElement('span');
  entryContentEl.setAttribute('data-part', 'entry-content');
  entryItemEl.appendChild(entryContentEl);

  const entryMetaEl = document.createElement('span');
  entryMetaEl.setAttribute('data-part', 'entry-meta');
  entryItemEl.appendChild(entryMetaEl);

  const deleteButtonEl = document.createElement('button');
  deleteButtonEl.setAttribute('type', 'button');
  deleteButtonEl.setAttribute('data-part', 'delete-button');
  deleteButtonEl.setAttribute('aria-label', 'Delete entry');
  deleteButtonEl.setAttribute('tabindex', '0');
  deleteButtonEl.textContent = 'Delete';
  deleteButtonEl.style.display = 'none';
  deleteButtonEl.addEventListener('click', (e) => { e.stopPropagation(); send('DELETE'); });
  root.appendChild(deleteButtonEl);

  const confirmDeleteEl = document.createElement('div');
  confirmDeleteEl.setAttribute('data-part', 'confirm-delete');
  confirmDeleteEl.setAttribute('role', 'alertdialog');
  confirmDeleteEl.style.display = 'none';
  root.appendChild(confirmDeleteEl);

  const confirmBtn = document.createElement('button');
  confirmBtn.setAttribute('type', 'button');
  confirmBtn.setAttribute('data-part', 'confirm-button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.addEventListener('click', () => send('CONFIRM'));
  confirmDeleteEl.appendChild(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.setAttribute('data-part', 'cancel-button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => send('CANCEL'));
  confirmDeleteEl.appendChild(cancelBtn);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchBarEl.setAttribute('data-state', s);
    entryItemEl.setAttribute('data-selected', s === 'entrySelected' || s === 'deleting' ? 'true' : 'false');
    deleteButtonEl.style.display = s === 'entrySelected' ? '' : 'none';
    confirmDeleteEl.style.display = s === 'deleting' ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default MemoryInspector;
