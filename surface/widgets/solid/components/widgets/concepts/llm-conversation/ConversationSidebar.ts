import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
  isActive?: boolean;
  model?: string;
  tags?: string[];
  folder?: string;
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  if (isNaN(then)) return isoTimestamp;
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '\u2026';
}

function groupByDate(conversations: ConversationItem[]): { label: string; items: ConversationItem[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 7 * 86_400_000;
  const buckets: Record<string, ConversationItem[]> = { Today: [], Yesterday: [], 'Past 7 days': [], Older: [] };
  for (const c of conversations) {
    const t = new Date(c.timestamp).getTime();
    if (t >= todayStart) buckets['Today'].push(c);
    else if (t >= yesterdayStart) buckets['Yesterday'].push(c);
    else if (t >= weekStart) buckets['Past 7 days'].push(c);
    else buckets['Older'].push(c);
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
}

export interface ConversationSidebarProps { [key: string]: unknown; class?: string; }
export interface ConversationSidebarResult { element: HTMLElement; dispose: () => void; }

export function ConversationSidebar(props: ConversationSidebarProps): ConversationSidebarResult {
  const sig = surfaceCreateSignal<ConversationSidebarState>('idle');
  const send = (event: ConversationSidebarEvent) => { sig.set(conversationSidebarReducer(sig.get(), event)); };

  const conversations = (props.conversations ?? []) as ConversationItem[];
  const selectedId = props.selectedId as string | undefined;
  const showPreview = props.showPreview !== false;
  const showModel = props.showModel !== false;
  const previewMaxLength = Number(props.previewMaxLength ?? 80);
  const onSelect = props.onSelect as ((id: string) => void) | undefined;
  const onCreate = props.onCreate as (() => void) | undefined;
  const onDelete = props.onDelete as ((id: string) => void) | undefined;
  const searchPlaceholder = String(props.searchPlaceholder ?? 'Search conversations\u2026');

  let searchQuery = '';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'conversation-sidebar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'navigation');
  root.setAttribute('aria-label', 'Conversation history');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Search
  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-part', 'search');
  searchDiv.setAttribute('data-state', sig.get());
  root.appendChild(searchDiv);

  const searchInput = document.createElement('input');
  searchInput.setAttribute('type', 'search');
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.setAttribute('aria-label', 'Search conversations');
  searchInput.setAttribute('role', 'searchbox');
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.placeholder = searchPlaceholder;
  searchDiv.appendChild(searchInput);

  // New conversation button
  const newBtn = document.createElement('button');
  newBtn.setAttribute('type', 'button');
  newBtn.setAttribute('data-part', 'new-button');
  newBtn.setAttribute('aria-label', 'New conversation');
  newBtn.setAttribute('tabindex', '0');
  newBtn.textContent = '+ New conversation';
  newBtn.addEventListener('click', () => onCreate?.());
  root.appendChild(newBtn);

  // Group list
  const groupListEl = document.createElement('div');
  groupListEl.setAttribute('data-part', 'group-list');
  groupListEl.setAttribute('role', 'list');
  groupListEl.setAttribute('aria-label', 'Conversations');
  root.appendChild(groupListEl);

  const renderList = () => {
    groupListEl.innerHTML = '';
    const filtered = searchQuery.trim()
      ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
      : conversations;
    const groups = groupByDate(filtered);

    if (filtered.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.setAttribute('data-part', 'empty-state');
      emptyEl.setAttribute('role', 'status');
      emptyEl.setAttribute('aria-live', 'polite');
      emptyEl.textContent = searchQuery.trim() ? 'No conversations match your search.' : 'No conversations yet.';
      groupListEl.appendChild(emptyEl);
      return;
    }

    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.setAttribute('data-part', 'group');
      groupEl.setAttribute('role', 'group');
      groupEl.setAttribute('aria-label', group.label);

      const headerEl = document.createElement('div');
      headerEl.setAttribute('data-part', 'group-header');
      headerEl.setAttribute('role', 'presentation');
      headerEl.setAttribute('aria-hidden', 'true');
      headerEl.textContent = group.label;
      groupEl.appendChild(headerEl);

      for (const item of group.items) {
        const isSelected = item.id === selectedId;
        const itemEl = document.createElement('div');
        itemEl.setAttribute('data-part', 'conversation-item');
        itemEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
        itemEl.setAttribute('data-active', item.isActive ? 'true' : 'false');
        itemEl.setAttribute('role', 'option');
        itemEl.setAttribute('aria-selected', String(isSelected));
        itemEl.setAttribute('aria-label', `${item.title} \u2014 ${formatRelativeTime(item.timestamp)}`);
        itemEl.setAttribute('tabindex', '-1');

        const titleSpan = document.createElement('span');
        titleSpan.setAttribute('data-part', 'item-title');
        titleSpan.textContent = item.title;
        itemEl.appendChild(titleSpan);

        if (showPreview) {
          const previewSpan = document.createElement('span');
          previewSpan.setAttribute('data-part', 'item-preview');
          previewSpan.setAttribute('data-visible', 'true');
          previewSpan.textContent = truncate(item.lastMessage, previewMaxLength);
          itemEl.appendChild(previewSpan);
        }

        const tsSpan = document.createElement('span');
        tsSpan.setAttribute('data-part', 'item-timestamp');
        tsSpan.textContent = formatRelativeTime(item.timestamp);
        itemEl.appendChild(tsSpan);

        const countSpan = document.createElement('span');
        countSpan.setAttribute('data-part', 'item-count');
        countSpan.setAttribute('aria-label', `${item.messageCount} messages`);
        countSpan.textContent = String(item.messageCount);
        itemEl.appendChild(countSpan);

        if (showModel && item.model) {
          const modelSpan = document.createElement('span');
          modelSpan.setAttribute('data-part', 'item-model');
          modelSpan.setAttribute('data-visible', 'true');
          modelSpan.setAttribute('aria-label', `Model: ${item.model}`);
          modelSpan.textContent = item.model;
          itemEl.appendChild(modelSpan);
        }

        itemEl.addEventListener('click', () => {
          send({ type: 'SELECT' });
          onSelect?.(item.id);
        });

        groupEl.appendChild(itemEl);
      }

      groupListEl.appendChild(groupEl);
    }
  };

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchQuery.trim() && sig.get() !== 'searching') send({ type: 'SEARCH' });
    else if (!searchQuery.trim() && sig.get() === 'searching') send({ type: 'CLEAR_SEARCH' });
    renderList();
  });

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && sig.get() === 'contextOpen') {
      e.preventDefault();
      send({ type: 'CLOSE_CONTEXT' });
    }
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); onCreate?.(); }
    if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchInput.focus(); }
    if (e.key === 'Delete') {
      e.preventDefault();
      if (selectedId) onDelete?.(selectedId);
    }
  });

  renderList();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchDiv.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ConversationSidebar;
