/* ---------------------------------------------------------------------------
 * ConversationSidebar state machine
 * States: idle (initial), searching, contextOpen
 * See widget spec: conversation-sidebar.widget
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
 * Conversation item type
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

/* ---------------------------------------------------------------------------
 * Context menu action type
 * ------------------------------------------------------------------------- */

export type ContextMenuAction = 'rename' | 'delete' | 'archive' | 'share';

/* ---------------------------------------------------------------------------
 * Relative timestamp helper
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

/* ---------------------------------------------------------------------------
 * Grouping helper — groups conversations by date bucket
 * ------------------------------------------------------------------------- */

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
    Today: [],
    Yesterday: [],
    'Past 7 days': [],
    Older: [],
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

function groupByFolder(conversations: ConversationItem[]): ConversationGroup[] {
  const map = new Map<string, ConversationItem[]>();
  for (const c of conversations) {
    const folder = c.folder ?? 'Ungrouped';
    if (!map.has(folder)) map.set(folder, []);
    map.get(folder)!.push(c);
  }
  return Array.from(map.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  }));
}

function groupByTag(conversations: ConversationItem[]): ConversationGroup[] {
  const map = new Map<string, ConversationItem[]>();
  for (const c of conversations) {
    const tags = c.tags && c.tags.length > 0 ? c.tags : ['Untagged'];
    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, []);
      map.get(tag)!.push(c);
    }
  }
  return Array.from(map.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  }));
}

/* ---------------------------------------------------------------------------
 * Truncate helper
 * ------------------------------------------------------------------------- */

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '\u2026';
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ConversationSidebarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** Array of conversations to display. */
  conversations: ConversationItem[];
  /** Currently selected conversation ID. */
  selectedId?: string | undefined;
  /** How to group conversations. */
  groupBy?: 'date' | 'folder' | 'tag';
  /** Show last message preview text. */
  showPreview?: boolean;
  /** Show model badge on items. */
  showModel?: boolean;
  /** Maximum length for preview text before truncation. */
  previewMaxLength?: number;
  /** Fired when a conversation is selected. */
  onSelect?: (id: string) => void;
  /** Fired when "New conversation" is requested. */
  onCreate?: () => void;
  /** Fired when a conversation is deleted. */
  onDelete?: (id: string) => void;
  /** Fired when a context menu action is taken. */
  onContextAction?: (action: ContextMenuAction, id: string) => void;
  /** Override for search input placeholder. */
  searchPlaceholder?: string;
  /** Optional children rendered after the list. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ConversationSidebar = forwardRef<HTMLDivElement, ConversationSidebarProps>(function ConversationSidebar(
  {
    conversations,
    selectedId,
    groupBy = 'date',
    showPreview = true,
    showModel = true,
    previewMaxLength = 80,
    onSelect,
    onCreate,
    onDelete,
    onContextAction,
    searchPlaceholder = 'Search conversations\u2026',
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(conversationSidebarReducer, 'idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  /* Filter conversations by search query */
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [conversations, searchQuery]);

  /* Group filtered conversations */
  const groups = useMemo(() => {
    switch (groupBy) {
      case 'folder': return groupByFolder(filtered);
      case 'tag': return groupByTag(filtered);
      case 'date':
      default: return groupByDate(filtered);
    }
  }, [filtered, groupBy]);

  /* Flat ordered list of conversation IDs for keyboard navigation */
  const flatItems = useMemo(() => {
    const result: ConversationItem[] = [];
    for (const g of groups) {
      for (const item of g.items) {
        result.push(item);
      }
    }
    return result;
  }, [groups]);

  /* Focus a specific item by flat index */
  const focusItem = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, flatItems.length - 1));
    setFocusIndex(clamped);
    const el = itemRefs.current.get(clamped);
    el?.focus();
  }, [flatItems.length]);

  /* Select conversation handler */
  const handleSelect = useCallback((id: string) => {
    send({ type: 'SELECT' });
    setSearchQuery('');
    onSelect?.(id);
  }, [onSelect]);

  /* Create handler */
  const handleCreate = useCallback(() => {
    onCreate?.();
  }, [onCreate]);

  /* Context menu handler */
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenuId(id);
    send({ type: 'CONTEXT_MENU' });
  }, []);

  /* Context action handler */
  const handleContextAction = useCallback((action: ContextMenuAction) => {
    if (contextMenuId) {
      if (action === 'delete') {
        onDelete?.(contextMenuId);
      }
      onContextAction?.(action, contextMenuId);
    }
    setContextMenuId(null);
    send({ type: 'ACTION' });
  }, [contextMenuId, onDelete, onContextAction]);

  /* Close context menu */
  const closeContextMenu = useCallback(() => {
    setContextMenuId(null);
    send({ type: 'CLOSE_CONTEXT' });
  }, []);

  /* Search change handler */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setFocusIndex(-1);
    if (value.trim() && state !== 'searching') {
      send({ type: 'SEARCH' });
    } else if (!value.trim() && state === 'searching') {
      send({ type: 'CLEAR_SEARCH' });
    }
  }, [state]);

  /* Root keyboard handler */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusIndex < flatItems.length - 1 ? focusIndex + 1 : 0;
        focusItem(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusIndex > 0 ? focusIndex - 1 : flatItems.length - 1;
        focusItem(prev);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < flatItems.length) {
          handleSelect(flatItems[focusIndex].id);
        }
        break;
      }
      case 'Delete': {
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < flatItems.length) {
          onDelete?.(flatItems[focusIndex].id);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        if (state === 'contextOpen') {
          closeContextMenu();
        }
        break;
      }
      default:
        if (e.ctrlKey && e.key === 'n') {
          e.preventDefault();
          handleCreate();
        }
        if (e.ctrlKey && e.key === 'f') {
          e.preventDefault();
          searchRef.current?.focus();
        }
        break;
    }
  }, [focusIndex, flatItems, focusItem, handleSelect, handleCreate, onDelete, state, closeContextMenu]);

  /* Track flat index for ref assignment */
  let flatCounter = 0;

  return (
    <div
      ref={ref}
      role="navigation"
      aria-label="Conversation history"
      data-surface-widget=""
      data-widget-name="conversation-sidebar"
      data-part="root"
      data-state={state}
      data-group-by={groupBy}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Search input */}
      <div data-part="search" data-state={state}>
        <input
          ref={searchRef}
          type="search"
          data-part="search-input"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label="Search conversations"
          role="searchbox"
          autoComplete="off"
        />
      </div>

      {/* New conversation button */}
      <button
        type="button"
        data-part="new-button"
        aria-label="New conversation"
        tabIndex={0}
        onClick={handleCreate}
      >
        + New conversation
      </button>

      {/* Grouped conversation list */}
      <div data-part="group-list" role="list" aria-label="Conversations">
        {groups.map((group) => (
          <div key={group.label} data-part="group" role="group" aria-label={group.label}>
            {/* Group header */}
            <div data-part="group-header" role="presentation" aria-hidden="true">
              {group.label}
            </div>

            {/* Conversation items */}
            {group.items.map((item) => {
              const currentIndex = flatCounter++;
              const isSelected = item.id === selectedId;
              const isFocused = currentIndex === focusIndex;

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(currentIndex, el);
                    else itemRefs.current.delete(currentIndex);
                  }}
                  data-part="conversation-item"
                  data-selected={isSelected ? 'true' : 'false'}
                  data-active={item.isActive ? 'true' : 'false'}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${item.title} \u2014 ${formatRelativeTime(item.timestamp)}`}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => handleSelect(item.id)}
                  onContextMenu={(e) => handleContextMenu(e, item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(item.id);
                    }
                  }}
                >
                  {/* Title */}
                  <span data-part="item-title">{item.title}</span>

                  {/* Preview */}
                  {showPreview && (
                    <span data-part="item-preview" data-visible="true">
                      {truncate(item.lastMessage, previewMaxLength)}
                    </span>
                  )}

                  {/* Timestamp + message count */}
                  <span data-part="item-timestamp">
                    {formatRelativeTime(item.timestamp)}
                  </span>

                  <span data-part="item-count" aria-label={`${item.messageCount} messages`}>
                    {item.messageCount}
                  </span>

                  {/* Model badge */}
                  {showModel && item.model && (
                    <span data-part="item-model" data-visible="true" aria-label={`Model: ${item.model}`}>
                      {item.model}
                    </span>
                  )}

                  {/* Context menu (rendered inline when open for this item) */}
                  {state === 'contextOpen' && contextMenuId === item.id && (
                    <div
                      data-part="context-menu"
                      role="menu"
                      aria-label="Conversation actions"
                    >
                      {(['rename', 'delete', 'archive', 'share'] as const).map((action) => (
                        <button
                          key={action}
                          type="button"
                          role="menuitem"
                          data-part="context-menu-item"
                          data-action={action}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContextAction(action);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              closeContextMenu();
                            }
                          }}
                        >
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Empty state */}
        {flatItems.length === 0 && (
          <div data-part="empty-state" role="status" aria-live="polite">
            {searchQuery.trim() ? 'No conversations match your search.' : 'No conversations yet.'}
          </div>
        )}
      </div>

      {children}
    </div>
  );
});

ConversationSidebar.displayName = 'ConversationSidebar';
export { ConversationSidebar };
export default ConversationSidebar;
