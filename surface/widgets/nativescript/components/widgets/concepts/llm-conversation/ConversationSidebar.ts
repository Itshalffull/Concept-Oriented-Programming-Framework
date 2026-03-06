import { StackLayout, Label, Button, ScrollView, TextField, FlexboxLayout } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * ConversationSidebar state machine
 * States: idle (initial), searching, contextOpen
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

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ConversationItem {
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

export type ContextMenuAction = 'rename' | 'delete' | 'archive' | 'share';

export interface ConversationSidebarProps {
  conversations: ConversationItem[];
  selectedId?: string;
  groupBy?: 'date' | 'folder' | 'tag';
  showPreview?: boolean;
  showModel?: boolean;
  previewMaxLength?: number;
  onSelect?: (id: string) => void;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onContextAction?: (action: ContextMenuAction, id: string) => void;
  searchPlaceholder?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

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

interface ConversationGroup {
  label: string;
  items: ConversationItem[];
}

function groupByDate(conversations: ConversationItem[]): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 7 * 86_400_000;

  const buckets: Record<string, ConversationItem[]> = {
    Today: [], Yesterday: [], 'Past 7 days': [], Older: [],
  };

  for (const c of conversations) {
    const t = new Date(c.timestamp).getTime();
    if (t >= todayStart) buckets['Today'].push(c);
    else if (t >= yesterdayStart) buckets['Yesterday'].push(c);
    else if (t >= weekStart) buckets['Past 7 days'].push(c);
    else buckets['Older'].push(c);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({
      label,
      items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }));
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createConversationSidebar(props: ConversationSidebarProps): { view: StackLayout; dispose: () => void } {
  const {
    conversations,
    selectedId,
    showPreview = true,
    showModel = true,
    previewMaxLength = 80,
    onSelect,
    onCreate,
    onDelete,
    onContextAction,
    searchPlaceholder = 'Search conversations\u2026',
  } = props;

  let widgetState: ConversationSidebarState = 'idle';
  let searchQuery = '';
  let contextMenuId: string | null = null;
  const disposers: (() => void)[] = [];

  function send(event: ConversationSidebarEvent) {
    widgetState = conversationSidebarReducer(widgetState, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'conversation-sidebar';
  root.automationText = 'Conversation history';

  // Search
  const searchField = new TextField();
  searchField.className = 'conversation-sidebar-search';
  searchField.hint = searchPlaceholder;
  searchField.automationText = 'Search conversations';
  const searchHandler = () => {
    searchQuery = searchField.text || '';
    if (searchQuery.trim() && widgetState !== 'searching') {
      send({ type: 'SEARCH' });
    } else if (!searchQuery.trim() && widgetState === 'searching') {
      send({ type: 'CLEAR_SEARCH' });
    }
    rebuildList();
  };
  searchField.on('textChange', searchHandler);
  disposers.push(() => searchField.off('textChange', searchHandler));
  root.addChild(searchField);

  // New conversation button
  const newBtn = new Button();
  newBtn.className = 'conversation-sidebar-new';
  newBtn.text = '+ New conversation';
  newBtn.automationText = 'New conversation';
  const newHandler = () => { onCreate?.(); };
  newBtn.on('tap', newHandler);
  disposers.push(() => newBtn.off('tap', newHandler));
  root.addChild(newBtn);

  // Conversation list
  const scrollView = new ScrollView();
  const listContainer = new StackLayout();
  listContainer.className = 'conversation-sidebar-list';
  scrollView.content = listContainer;
  root.addChild(scrollView);

  // Context menu overlay
  const contextMenu = new StackLayout();
  contextMenu.className = 'conversation-sidebar-context-menu';
  contextMenu.visibility = 'collapse' as any;

  const contextActions: ContextMenuAction[] = ['rename', 'delete', 'archive', 'share'];
  for (const action of contextActions) {
    const actionBtn = new Button();
    actionBtn.className = 'conversation-sidebar-context-action';
    actionBtn.text = action.charAt(0).toUpperCase() + action.slice(1);
    const actionHandler = () => {
      if (contextMenuId) {
        if (action === 'delete') onDelete?.(contextMenuId);
        onContextAction?.(action, contextMenuId);
      }
      contextMenuId = null;
      send({ type: 'ACTION' });
    };
    actionBtn.on('tap', actionHandler);
    disposers.push(() => actionBtn.off('tap', actionHandler));
    contextMenu.addChild(actionBtn);
  }

  const dismissBtn = new Button();
  dismissBtn.className = 'conversation-sidebar-context-dismiss';
  dismissBtn.text = 'Cancel';
  const dismissHandler = () => {
    contextMenuId = null;
    send({ type: 'CLOSE_CONTEXT' });
  };
  dismissBtn.on('tap', dismissHandler);
  disposers.push(() => dismissBtn.off('tap', dismissHandler));
  contextMenu.addChild(dismissBtn);

  root.addChild(contextMenu);

  function rebuildList() {
    listContainer.removeChildren();
    const filtered = searchQuery.trim()
      ? conversations.filter((c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
      : conversations;

    const groups = groupByDate(filtered);

    for (const group of groups) {
      const groupHeader = new Label();
      groupHeader.className = 'conversation-sidebar-group-header';
      groupHeader.text = group.label;
      listContainer.addChild(groupHeader);

      for (const item of group.items) {
        const isSelected = item.id === selectedId;

        const itemView = new StackLayout();
        itemView.className = isSelected ? 'conversation-sidebar-item-selected' : 'conversation-sidebar-item';
        itemView.automationText = `${item.title} \u2014 ${formatRelativeTime(item.timestamp)}`;

        const titleLabel = new Label();
        titleLabel.className = 'conversation-sidebar-item-title';
        titleLabel.text = item.title;
        itemView.addChild(titleLabel);

        if (showPreview) {
          const previewLabel = new Label();
          previewLabel.className = 'conversation-sidebar-item-preview';
          previewLabel.text = truncate(item.lastMessage, previewMaxLength);
          itemView.addChild(previewLabel);
        }

        const metaRow = new FlexboxLayout();
        metaRow.flexDirection = 'row' as any;

        const tsLabel = new Label();
        tsLabel.className = 'conversation-sidebar-item-timestamp';
        tsLabel.text = formatRelativeTime(item.timestamp);
        metaRow.addChild(tsLabel);

        const countLabel = new Label();
        countLabel.className = 'conversation-sidebar-item-count';
        countLabel.text = String(item.messageCount);
        countLabel.automationText = `${item.messageCount} messages`;
        metaRow.addChild(countLabel);

        if (showModel && item.model) {
          const modelLabel = new Label();
          modelLabel.className = 'conversation-sidebar-item-model';
          modelLabel.text = item.model;
          modelLabel.automationText = `Model: ${item.model}`;
          metaRow.addChild(modelLabel);
        }

        itemView.addChild(metaRow);

        // Tap to select
        const tapHandler = () => {
          send({ type: 'SELECT' });
          searchQuery = '';
          searchField.text = '';
          onSelect?.(item.id);
        };
        itemView.on('tap', tapHandler);

        // Long press for context menu
        const longPressHandler = () => {
          contextMenuId = item.id;
          send({ type: 'CONTEXT_MENU' });
        };
        itemView.on('longPress', longPressHandler);

        listContainer.addChild(itemView);
      }
    }

    if (filtered.length === 0) {
      const emptyLabel = new Label();
      emptyLabel.className = 'conversation-sidebar-empty';
      emptyLabel.text = searchQuery.trim() ? 'No conversations match your search.' : 'No conversations yet.';
      listContainer.addChild(emptyLabel);
    }
  }

  rebuildList();

  function update() {
    contextMenu.visibility = (widgetState === 'contextOpen' ? 'visible' : 'collapse') as any;
  }

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createConversationSidebar;
