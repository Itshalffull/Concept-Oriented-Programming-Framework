/* ---------------------------------------------------------------------------
 * MemoryInspector — Vanilla implementation
 *
 * Displays agent memory entries with tabs (working/long-term), search,
 * entry selection, token usage, and delete with confirm.
 * ------------------------------------------------------------------------- */

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

export interface MemoryEntry {
  id: string;
  label: string;
  content: string;
  type: 'working' | 'long-term';
  tokens?: number;
  timestamp?: string;
}

export interface MemoryInspectorProps {
  [key: string]: unknown;
  className?: string;
  entries?: MemoryEntry[];
  totalTokens?: number;
  maxTokens?: number;
  onDelete?: (id: string) => void;
  onSelectEntry?: (id: string) => void;
}
export interface MemoryInspectorOptions { target: HTMLElement; props: MemoryInspectorProps; }

let _memoryInspectorUid = 0;

export class MemoryInspector {
  private el: HTMLElement;
  private props: MemoryInspectorProps;
  private state: MemoryInspectorState = 'viewing';
  private disposers: Array<() => void> = [];
  private activeTab: 'working' | 'long-term' = 'working';
  private searchQuery = '';
  private selectedEntryId: string | null = null;
  private focusIndex = 0;

  constructor(options: MemoryInspectorOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'memory-inspector');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Memory inspector');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'memory-inspector-' + (++_memoryInspectorUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = memoryInspectorReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<MemoryInspectorProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private getFiltered(): MemoryEntry[] {
    const entries = (this.props.entries ?? []) as MemoryEntry[];
    let filtered = entries.filter(e => e.type === this.activeTab);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(e => e.label.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
    }
    return filtered;
  }

  private render(): void {
    const { totalTokens = 0, maxTokens = 4096 } = this.props;
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;
    const filtered = this.getFiltered();

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, filtered.length - 1); this.updateFocus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.updateFocus(); }
      if (e.key === 'Enter') { e.preventDefault(); const entry = filtered[this.focusIndex]; if (entry) { this.selectedEntryId = entry.id; this.send('SELECT_ENTRY'); this.props.onSelectEntry?.(entry.id); this.rerender(); } }
      if (e.key === 'Escape') { e.preventDefault(); if (this.state === 'deleting') { this.send('CANCEL'); } else { this.selectedEntryId = null; this.send('DESELECT'); } this.rerender(); }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Tabs
    const tabs = document.createElement('div');
    tabs.setAttribute('data-part', 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const tab of ['working', 'long-term'] as const) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-part', 'tab');
      btn.setAttribute('data-active', this.activeTab === tab ? 'true' : 'false');
      btn.setAttribute('aria-selected', this.activeTab === tab ? 'true' : 'false');
      btn.textContent = tab === 'working' ? 'Working Memory' : 'Long-term Memory';
      const onTab = () => { this.activeTab = tab; this.send('SWITCH_TAB'); this.rerender(); };
      btn.addEventListener('click', onTab);
      this.disposers.push(() => btn.removeEventListener('click', onTab));
      tabs.appendChild(btn);
    }
    this.el.appendChild(tabs);

    // Token usage
    const tokenPct = maxTokens > 0 ? Math.round((totalTokens / maxTokens) * 100) : 0;
    const contextBar = document.createElement('div');
    contextBar.setAttribute('data-part', 'context-bar');
    contextBar.setAttribute('role', 'progressbar');
    contextBar.setAttribute('aria-valuenow', String(tokenPct));
    contextBar.setAttribute('aria-label', `Token usage: ${totalTokens}/${maxTokens}`);
    const barFill = document.createElement('div');
    barFill.setAttribute('data-part', 'context-fill');
    barFill.style.width = `${tokenPct}%`;
    contextBar.appendChild(barFill);
    const barLabel = document.createElement('span');
    barLabel.textContent = `${totalTokens}/${maxTokens} tokens`;
    contextBar.appendChild(barLabel);
    this.el.appendChild(contextBar);

    // Search
    const searchBar = document.createElement('div');
    searchBar.setAttribute('data-part', 'search-bar');
    const searchInput = document.createElement('input');
    searchInput.setAttribute('type', 'search');
    searchInput.setAttribute('placeholder', 'Search memory...');
    searchInput.setAttribute('aria-label', 'Search memory entries');
    searchInput.value = this.searchQuery;
    const onSearch = () => {
      this.searchQuery = searchInput.value;
      this.send(this.searchQuery ? 'SEARCH' : 'CLEAR');
      this.rebuildEntries();
    };
    searchInput.addEventListener('input', onSearch);
    this.disposers.push(() => searchInput.removeEventListener('input', onSearch));
    searchBar.appendChild(searchInput);
    this.el.appendChild(searchBar);

    // Entry list
    const view = document.createElement('div');
    view.setAttribute('data-part', 'working-view');
    view.setAttribute('role', 'list');
    this.renderEntries(view, filtered);
    this.el.appendChild(view);

    // Delete confirmation
    if (this.state === 'deleting') {
      const dialog = document.createElement('div');
      dialog.setAttribute('data-part', 'delete-confirm');
      dialog.setAttribute('role', 'alertdialog');
      dialog.textContent = 'Delete this memory entry?';
      const confirmBtn = document.createElement('button');
      confirmBtn.setAttribute('type', 'button');
      confirmBtn.textContent = 'Delete';
      const onConfirm = () => { if (this.selectedEntryId) this.props.onDelete?.(this.selectedEntryId); this.selectedEntryId = null; this.send('CONFIRM'); this.rerender(); };
      confirmBtn.addEventListener('click', onConfirm);
      this.disposers.push(() => confirmBtn.removeEventListener('click', onConfirm));
      dialog.appendChild(confirmBtn);
      const cancelBtn = document.createElement('button');
      cancelBtn.setAttribute('type', 'button');
      cancelBtn.textContent = 'Cancel';
      const onCancel = () => { this.send('CANCEL'); this.rerender(); };
      cancelBtn.addEventListener('click', onCancel);
      this.disposers.push(() => cancelBtn.removeEventListener('click', onCancel));
      dialog.appendChild(cancelBtn);
      this.el.appendChild(dialog);
    }
  }

  private renderEntries(container: HTMLElement, entries: MemoryEntry[]): void {
    container.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.setAttribute('data-part', 'empty-state');
      empty.textContent = this.searchQuery ? 'No matching entries' : 'No memory entries';
      container.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const isSelected = this.selectedEntryId === entry.id;
      const item = document.createElement('div');
      item.setAttribute('data-part', 'entry-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-selected', isSelected ? 'true' : 'false');
      item.setAttribute('tabindex', this.focusIndex === index ? '0' : '-1');

      const label = document.createElement('span');
      label.setAttribute('data-part', 'entry-label');
      label.textContent = entry.label;
      item.appendChild(label);

      const content = document.createElement('span');
      content.setAttribute('data-part', 'entry-content');
      content.textContent = entry.content.length > 100 ? entry.content.slice(0, 97) + '...' : entry.content;
      item.appendChild(content);

      const meta = document.createElement('span');
      meta.setAttribute('data-part', 'entry-meta');
      const parts: string[] = [];
      if (entry.tokens) parts.push(`${entry.tokens} tokens`);
      if (entry.timestamp) parts.push(entry.timestamp);
      meta.textContent = parts.join(' | ');
      item.appendChild(meta);

      if (isSelected) {
        const deleteBtn = document.createElement('button');
        deleteBtn.setAttribute('data-part', 'delete-button');
        deleteBtn.setAttribute('type', 'button');
        deleteBtn.setAttribute('aria-label', 'Delete entry');
        deleteBtn.textContent = '\u2715';
        const onDelete = (e: Event) => { e.stopPropagation(); this.send('DELETE'); this.rerender(); };
        deleteBtn.addEventListener('click', onDelete);
        this.disposers.push(() => deleteBtn.removeEventListener('click', onDelete));
        item.appendChild(deleteBtn);
      }

      const onClick = () => {
        this.selectedEntryId = entry.id;
        this.focusIndex = index;
        this.send('SELECT_ENTRY');
        this.props.onSelectEntry?.(entry.id);
        this.rerender();
      };
      item.addEventListener('click', onClick);
      this.disposers.push(() => item.removeEventListener('click', onClick));
      container.appendChild(item);
    });
  }

  private rebuildEntries(): void {
    const view = this.el.querySelector('[data-part="working-view"]') as HTMLElement;
    if (view) this.renderEntries(view, this.getFiltered());
  }

  private updateFocus(): void {
    const nodes = this.el.querySelectorAll('[data-part="entry-item"]');
    nodes.forEach((n, i) => {
      (n as HTMLElement).setAttribute('tabindex', i === this.focusIndex ? '0' : '-1');
      if (i === this.focusIndex) (n as HTMLElement).focus();
    });
  }
}

export default MemoryInspector;
