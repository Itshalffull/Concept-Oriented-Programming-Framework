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

type MemoryEntryType = 'fact' | 'instruction' | 'conversation' | 'tool-result';

interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  source?: string;
  timestamp?: string;
  relevance?: number;
}

const ENTRY_TYPE_ORDER: MemoryEntryType[] = ['fact', 'instruction', 'conversation', 'tool-result'];
const TYPE_LABELS: Record<MemoryEntryType, string> = { fact: 'Facts', instruction: 'Instructions', conversation: 'Conversation', 'tool-result': 'Tool Results' };
const TAB_VALUES = ['working', 'episodic', 'semantic', 'procedural'] as const;
const TAB_LABELS: Record<string, string> = { working: 'Working', episodic: 'Episodic', semantic: 'Semantic', procedural: 'Procedural' };

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\u2026';
}

function formatNumber(n: number): string { return n.toLocaleString(); }

export interface MemoryInspectorProps { [key: string]: unknown; class?: string; }
export interface MemoryInspectorResult { element: HTMLElement; dispose: () => void; }

export function MemoryInspector(props: MemoryInspectorProps): MemoryInspectorResult {
  const sig = surfaceCreateSignal<MemoryInspectorState>('viewing');
  const send = (event: MemoryInspectorEvent) => { sig.set(memoryInspectorReducer(sig.get(), event)); };

  const entries = (props.entries ?? []) as MemoryEntry[];
  const totalTokens = Number(props.totalTokens ?? 0);
  const maxTokens = Number(props.maxTokens ?? 0);
  const activeTab = String(props.activeTab ?? 'working');
  const showContext = props.showContext !== false;
  const onDelete = props.onDelete as ((id: string) => void) | undefined;
  const onTabChange = props.onTabChange as ((tab: string) => void) | undefined;

  let searchQuery = '';
  let selectedId: string | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'memory-inspector');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Memory inspector');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Tabs
  const tabsEl = document.createElement('div');
  tabsEl.setAttribute('data-part', 'tabs');
  tabsEl.setAttribute('data-active', activeTab);
  tabsEl.setAttribute('role', 'tablist');
  tabsEl.setAttribute('aria-label', 'Memory types');
  root.appendChild(tabsEl);

  for (const tab of TAB_VALUES) {
    const tabBtn = document.createElement('button');
    tabBtn.setAttribute('type', 'button');
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('aria-selected', String(tab === activeTab));
    tabBtn.setAttribute('data-part', 'tab');
    tabBtn.setAttribute('data-active', tab === activeTab ? 'true' : 'false');
    tabBtn.setAttribute('tabindex', tab === activeTab ? '0' : '-1');
    tabBtn.textContent = TAB_LABELS[tab];
    tabBtn.addEventListener('click', () => { send({ type: 'SWITCH_TAB' }); onTabChange?.(tab); });
    tabsEl.appendChild(tabBtn);
  }

  // Search
  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-part', 'search');
  searchDiv.setAttribute('data-state', sig.get());
  root.appendChild(searchDiv);

  const searchInput = document.createElement('input');
  searchInput.setAttribute('type', 'text');
  searchInput.setAttribute('role', 'searchbox');
  searchInput.setAttribute('aria-label', 'Search memories');
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.placeholder = 'Search memories...';
  searchDiv.appendChild(searchInput);

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchQuery.trim() && sig.get() !== 'searching') send({ type: 'SEARCH' });
    else if (!searchQuery.trim() && sig.get() === 'searching') send({ type: 'CLEAR' });
    renderEntries();
  });

  // Context bar
  if (showContext) {
    const tokenPercent = maxTokens > 0 ? Math.min((totalTokens / maxTokens) * 100, 100) : 0;
    const contextBar = document.createElement('div');
    contextBar.setAttribute('data-part', 'context-bar');
    contextBar.setAttribute('data-visible', 'true');
    contextBar.setAttribute('role', 'img');
    contextBar.setAttribute('aria-label', `Context window allocation: ${formatNumber(totalTokens)} of ${formatNumber(maxTokens)} tokens used`);

    const fill = document.createElement('div');
    fill.setAttribute('data-part', 'context-bar-fill');
    fill.setAttribute('aria-hidden', 'true');
    fill.style.width = `${tokenPercent}%`;
    contextBar.appendChild(fill);

    const label = document.createElement('span');
    label.setAttribute('data-part', 'context-bar-label');
    label.setAttribute('aria-hidden', 'true');
    label.textContent = `${formatNumber(totalTokens)} / ${formatNumber(maxTokens)} tokens`;
    contextBar.appendChild(label);
    root.appendChild(contextBar);
  }

  // Entry list
  const workingViewEl = document.createElement('div');
  workingViewEl.setAttribute('data-part', 'working-view');
  workingViewEl.setAttribute('role', 'list');
  workingViewEl.setAttribute('aria-label', 'Memory entries');
  root.appendChild(workingViewEl);

  const renderEntries = () => {
    workingViewEl.innerHTML = '';
    const filtered = searchQuery.trim()
      ? entries.filter(e => e.content.toLowerCase().includes(searchQuery.toLowerCase()) || (e.source && e.source.toLowerCase().includes(searchQuery.toLowerCase())))
      : entries;

    const grouped = new Map<MemoryEntryType, MemoryEntry[]>();
    for (const t of ENTRY_TYPE_ORDER) grouped.set(t, []);
    for (const e of filtered) { const list = grouped.get(e.type); if (list) list.push(e); }
    for (const [k, v] of grouped) { if (v.length === 0) grouped.delete(k); }

    if (filtered.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.setAttribute('data-part', 'empty-state');
      emptyEl.setAttribute('role', 'status');
      emptyEl.setAttribute('aria-live', 'polite');
      emptyEl.textContent = searchQuery ? 'No matching entries found.' : 'No memory entries.';
      workingViewEl.appendChild(emptyEl);
      return;
    }

    for (const type of ENTRY_TYPE_ORDER) {
      const group = grouped.get(type);
      if (!group || group.length === 0) continue;

      const groupEl = document.createElement('div');
      groupEl.setAttribute('data-part', 'entry-group');
      groupEl.setAttribute('data-type', type);
      groupEl.setAttribute('role', 'group');
      groupEl.setAttribute('aria-label', TYPE_LABELS[type]);

      const headerEl = document.createElement('div');
      headerEl.setAttribute('data-part', 'group-header');
      headerEl.setAttribute('aria-hidden', 'true');
      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'group-label');
      labelEl.textContent = TYPE_LABELS[type];
      headerEl.appendChild(labelEl);
      const countEl = document.createElement('span');
      countEl.setAttribute('data-part', 'group-count');
      countEl.textContent = String(group.length);
      headerEl.appendChild(countEl);
      groupEl.appendChild(headerEl);

      for (const entry of group) {
        const isSelected = selectedId === entry.id;
        const entryEl = document.createElement('div');
        entryEl.setAttribute('data-part', 'entry');
        entryEl.setAttribute('data-type', entry.type);
        entryEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
        entryEl.setAttribute('role', 'listitem');
        entryEl.setAttribute('aria-label', `${entry.type}: ${truncate(entry.content, 60)}`);
        entryEl.setAttribute('aria-expanded', String(isSelected));
        entryEl.setAttribute('tabindex', '-1');

        const eLabelEl = document.createElement('span');
        eLabelEl.setAttribute('data-part', 'entry-label');
        eLabelEl.textContent = entry.type;
        entryEl.appendChild(eLabelEl);

        const eContentEl = document.createElement('span');
        eContentEl.setAttribute('data-part', 'entry-content');
        eContentEl.textContent = isSelected ? entry.content : truncate(entry.content, 120);
        entryEl.appendChild(eContentEl);

        if (entry.source) {
          const srcEl = document.createElement('span');
          srcEl.setAttribute('data-part', 'entry-meta');
          srcEl.setAttribute('data-meta-type', 'source');
          srcEl.textContent = entry.source;
          entryEl.appendChild(srcEl);
        }
        if (entry.timestamp) {
          const tsEl = document.createElement('span');
          tsEl.setAttribute('data-part', 'entry-meta');
          tsEl.setAttribute('data-meta-type', 'timestamp');
          tsEl.textContent = entry.timestamp;
          entryEl.appendChild(tsEl);
        }
        if (entry.relevance != null) {
          const relEl = document.createElement('span');
          relEl.setAttribute('data-part', 'entry-meta');
          relEl.setAttribute('data-meta-type', 'relevance');
          relEl.textContent = `${Math.round(entry.relevance * 100)}%`;
          entryEl.appendChild(relEl);
        }

        if (isSelected && sig.get() === 'entrySelected') {
          const delBtn = document.createElement('button');
          delBtn.setAttribute('type', 'button');
          delBtn.setAttribute('data-part', 'delete');
          delBtn.setAttribute('aria-label', 'Delete memory entry');
          delBtn.setAttribute('tabindex', '0');
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', (e) => { e.stopPropagation(); send({ type: 'DELETE' }); renderEntries(); });
          entryEl.appendChild(delBtn);
        }

        if (isSelected && sig.get() === 'deleting') {
          const confirmDiv = document.createElement('div');
          confirmDiv.setAttribute('data-part', 'delete-confirm');
          confirmDiv.setAttribute('role', 'alertdialog');
          confirmDiv.setAttribute('aria-label', 'Confirm deletion');

          const confirmText = document.createElement('span');
          confirmText.textContent = 'Delete this memory entry?';
          confirmDiv.appendChild(confirmText);

          const confirmBtn = document.createElement('button');
          confirmBtn.setAttribute('type', 'button');
          confirmBtn.setAttribute('data-part', 'confirm-button');
          confirmBtn.setAttribute('aria-label', 'Confirm delete');
          confirmBtn.setAttribute('tabindex', '0');
          confirmBtn.textContent = 'Confirm';
          confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); if (selectedId) onDelete?.(selectedId); send({ type: 'CONFIRM' }); selectedId = null; renderEntries(); });
          confirmDiv.appendChild(confirmBtn);

          const cancelBtn = document.createElement('button');
          cancelBtn.setAttribute('type', 'button');
          cancelBtn.setAttribute('data-part', 'cancel-button');
          cancelBtn.setAttribute('aria-label', 'Cancel delete');
          cancelBtn.setAttribute('tabindex', '0');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); send({ type: 'CANCEL' }); renderEntries(); });
          confirmDiv.appendChild(cancelBtn);

          entryEl.appendChild(confirmDiv);
        }

        entryEl.addEventListener('click', () => {
          if (isSelected) { selectedId = null; send({ type: 'DESELECT' }); }
          else { selectedId = entry.id; send({ type: 'SELECT_ENTRY' }); }
          renderEntries();
        });

        groupEl.appendChild(entryEl);
      }

      workingViewEl.appendChild(groupEl);
    }
  };

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchInput.focus(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'deleting') { send({ type: 'CANCEL' }); }
      else if (sig.get() === 'entrySelected') { selectedId = null; send({ type: 'DESELECT' }); }
      else if (sig.get() === 'searching') { searchQuery = ''; searchInput.value = ''; send({ type: 'CLEAR' }); }
      renderEntries();
    }
    if (e.key === 'Delete' && sig.get() === 'entrySelected') { e.preventDefault(); send({ type: 'DELETE' }); renderEntries(); }
  });

  renderEntries();

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default MemoryInspector;
