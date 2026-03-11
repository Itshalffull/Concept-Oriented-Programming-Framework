/* ---------------------------------------------------------------------------
 * ConversationSidebar — Vanilla implementation
 *
 * Sidebar listing conversations with search, new conversation button,
 * and keyboard navigation.
 * ------------------------------------------------------------------------- */

export type ConversationSidebarState = 'idle' | 'searching' | 'contextOpen';
export type ConversationSidebarEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT' }
  | { type: 'CONTEXT_MENU' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'CLOSE_CONTEXT' }
  | { type: 'ACTION' };

export function conversationSidebarReducer(state: ConversationSidebarState, event: ConversationSidebarEvent): ConversationSidebarState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT') return 'idle';
      if (event.type === 'CONTEXT_MENU') return 'contextOpen';
      return state;
    case 'searching':
      if (event.type === 'CLEAR_SEARCH') return 'idle';
      if (event.type === 'SELECT') return 'idle';
      return state;
    case 'contextOpen':
      if (event.type === 'CLOSE_CONTEXT') return 'idle';
      if (event.type === 'ACTION') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ConversationItem {
  id: string;
  title: string;
  preview?: string;
  timestamp?: string;
  model?: string;
  pinned?: boolean;
}

export interface ConversationSidebarProps {
  [key: string]: unknown;
  className?: string;
  conversations?: ConversationItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
  onDelete?: (id: string) => void;
}
export interface ConversationSidebarOptions { target: HTMLElement; props: ConversationSidebarProps; }

let _conversationSidebarUid = 0;

export class ConversationSidebar {
  private el: HTMLElement;
  private props: ConversationSidebarProps;
  private state: ConversationSidebarState = 'idle';
  private disposers: Array<() => void> = [];
  private searchQuery = '';
  private focusIndex = 0;

  constructor(options: ConversationSidebarOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'conversation-sidebar');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'navigation');
    this.el.setAttribute('aria-label', 'Conversations');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'conversation-sidebar-' + (++_conversationSidebarUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = conversationSidebarReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<ConversationSidebarProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private getFiltered(): ConversationItem[] {
    const conversations = (this.props.conversations ?? []) as ConversationItem[];
    if (!this.searchQuery) return conversations;
    const q = this.searchQuery.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q) || (c.preview ?? '').toLowerCase().includes(q));
  }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;
    const { selectedId } = this.props;
    const filtered = this.getFiltered();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, filtered.length - 1); this.updateFocus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.updateFocus(); }
      if (e.key === 'Enter') { e.preventDefault(); const c = filtered[this.focusIndex]; if (c) { this.send('SELECT'); this.props.onSelect?.(c.id); } }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Search
    const searchInput = document.createElement('input');
    searchInput.setAttribute('data-part', 'search-input');
    searchInput.setAttribute('type', 'search');
    searchInput.setAttribute('placeholder', 'Search conversations...');
    searchInput.setAttribute('aria-label', 'Search conversations');
    searchInput.value = this.searchQuery;
    const onSearch = () => {
      this.searchQuery = searchInput.value;
      this.send(this.searchQuery ? 'SEARCH' : 'CLEAR_SEARCH');
      this.rebuildList();
    };
    searchInput.addEventListener('input', onSearch);
    this.disposers.push(() => searchInput.removeEventListener('input', onSearch));
    this.el.appendChild(searchInput);

    // New button
    const newBtn = document.createElement('button');
    newBtn.setAttribute('data-part', 'new-button');
    newBtn.setAttribute('type', 'button');
    newBtn.setAttribute('aria-label', 'New conversation');
    newBtn.textContent = '+ New';
    const onNew = () => this.props.onNew?.();
    newBtn.addEventListener('click', onNew);
    this.disposers.push(() => newBtn.removeEventListener('click', onNew));
    this.el.appendChild(newBtn);

    // List
    const groupList = document.createElement('div');
    groupList.setAttribute('data-part', 'group-list');
    groupList.setAttribute('role', 'list');
    this.el.appendChild(groupList);
    this.renderItems(groupList, filtered, selectedId as string | undefined);
  }

  private renderItems(container: HTMLElement, items: ConversationItem[], selectedId?: string): void {
    container.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.setAttribute('data-part', 'empty-state');
      empty.textContent = this.searchQuery ? 'No matching conversations' : 'No conversations';
      container.appendChild(empty);
      return;
    }
    items.forEach((conv, index) => {
      const item = document.createElement('div');
      item.setAttribute('data-part', 'conversation-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('data-selected', conv.id === selectedId ? 'true' : 'false');
      item.setAttribute('tabindex', this.focusIndex === index ? '0' : '-1');

      const title = document.createElement('span');
      title.setAttribute('data-part', 'item-title');
      title.textContent = conv.title.length > 40 ? conv.title.slice(0, 37) + '...' : conv.title;
      item.appendChild(title);

      if (conv.preview) {
        const preview = document.createElement('span');
        preview.setAttribute('data-part', 'item-preview');
        preview.textContent = conv.preview.length > 60 ? conv.preview.slice(0, 57) + '...' : conv.preview;
        item.appendChild(preview);
      }
      if (conv.timestamp) {
        const ts = document.createElement('span');
        ts.setAttribute('data-part', 'item-timestamp');
        ts.textContent = conv.timestamp;
        item.appendChild(ts);
      }
      if (conv.model) {
        const model = document.createElement('span');
        model.setAttribute('data-part', 'item-model');
        model.textContent = conv.model;
        item.appendChild(model);
      }

      const onClick = () => { this.send('SELECT'); this.props.onSelect?.(conv.id); };
      item.addEventListener('click', onClick);
      this.disposers.push(() => item.removeEventListener('click', onClick));
      container.appendChild(item);
    });
  }

  private rebuildList(): void {
    const list = this.el.querySelector('[data-part="group-list"]') as HTMLElement;
    if (list) this.renderItems(list, this.getFiltered(), this.props.selectedId as string | undefined);
  }

  private updateFocus(): void {
    const items = this.el.querySelectorAll('[data-part="conversation-item"]');
    items.forEach((item, i) => {
      (item as HTMLElement).setAttribute('tabindex', i === this.focusIndex ? '0' : '-1');
      if (i === this.focusIndex) (item as HTMLElement).focus();
    });
  }
}

export default ConversationSidebar;
