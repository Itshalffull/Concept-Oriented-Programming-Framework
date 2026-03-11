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

export interface ConversationSidebarProps { [key: string]: unknown; class?: string; }
export interface ConversationSidebarResult { element: HTMLElement; dispose: () => void; }

export function ConversationSidebar(props: ConversationSidebarProps): ConversationSidebarResult {
  const sig = surfaceCreateSignal<ConversationSidebarState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(conversationSidebarReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'conversation-sidebar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'navigation');
  root.setAttribute('aria-label', 'Conversation history');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && sig.get() === 'contextOpen') {
      e.preventDefault();
      send('CLOSE_CONTEXT');
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInputEl.focus();
    }
  });

  const searchWrapEl = document.createElement('div');
  searchWrapEl.setAttribute('data-part', 'search');
  root.appendChild(searchWrapEl);

  const searchInputEl = document.createElement('input');
  searchInputEl.setAttribute('type', 'search');
  searchInputEl.setAttribute('data-part', 'search-input');
  searchInputEl.setAttribute('placeholder', 'Search conversations\u2026');
  searchInputEl.setAttribute('aria-label', 'Search conversations');
  searchInputEl.setAttribute('role', 'searchbox');
  searchInputEl.setAttribute('autocomplete', 'off');
  searchInputEl.addEventListener('input', () => {
    const value = searchInputEl.value;
    if (value.trim() && sig.get() !== 'searching') {
      send('SEARCH');
    } else if (!value.trim() && sig.get() === 'searching') {
      send('CLEAR_SEARCH');
    }
  });
  searchWrapEl.appendChild(searchInputEl);

  const newButtonEl = document.createElement('button');
  newButtonEl.setAttribute('type', 'button');
  newButtonEl.setAttribute('data-part', 'new-button');
  newButtonEl.setAttribute('aria-label', 'New conversation');
  newButtonEl.setAttribute('tabindex', '0');
  newButtonEl.textContent = '+ New conversation';
  root.appendChild(newButtonEl);

  const groupListEl = document.createElement('div');
  groupListEl.setAttribute('data-part', 'group-list');
  groupListEl.setAttribute('role', 'list');
  groupListEl.setAttribute('aria-label', 'Conversations');
  root.appendChild(groupListEl);

  const groupHeaderEl = document.createElement('div');
  groupHeaderEl.setAttribute('data-part', 'group-header');
  groupHeaderEl.setAttribute('role', 'presentation');
  groupListEl.appendChild(groupHeaderEl);

  const conversationItemEl = document.createElement('div');
  conversationItemEl.setAttribute('data-part', 'conversation-item');
  conversationItemEl.setAttribute('role', 'option');
  conversationItemEl.setAttribute('tabindex', '-1');
  conversationItemEl.addEventListener('click', () => send('SELECT'));
  conversationItemEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    send('CONTEXT_MENU');
  });
  groupListEl.appendChild(conversationItemEl);

  const itemTitleEl = document.createElement('span');
  itemTitleEl.setAttribute('data-part', 'item-title');
  conversationItemEl.appendChild(itemTitleEl);

  const itemPreviewEl = document.createElement('span');
  itemPreviewEl.setAttribute('data-part', 'item-preview');
  itemPreviewEl.setAttribute('data-visible', 'true');
  conversationItemEl.appendChild(itemPreviewEl);

  const itemTimestampEl = document.createElement('span');
  itemTimestampEl.setAttribute('data-part', 'item-timestamp');
  conversationItemEl.appendChild(itemTimestampEl);

  const itemModelEl = document.createElement('span');
  itemModelEl.setAttribute('data-part', 'item-model');
  conversationItemEl.appendChild(itemModelEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchWrapEl.setAttribute('data-state', s);
    searchInputEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ConversationSidebar;
