/* ---------------------------------------------------------------------------
 * ConversationSidebar — Server Component
 *
 * Sidebar panel listing conversation history with search, folder/date
 * grouping, and context menu actions.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '\u2026';
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ConversationSidebarProps {
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
  /** Override for search input placeholder. */
  searchPlaceholder?: string;
  /** Optional children rendered after the list. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ConversationSidebar({
  conversations,
  selectedId,
  groupBy = 'date',
  showPreview = true,
  showModel = true,
  previewMaxLength = 80,
  searchPlaceholder = 'Search conversations\u2026',
  children,
}: ConversationSidebarProps) {
  const groups = (() => {
    switch (groupBy) {
      case 'folder': return groupByFolder(conversations);
      case 'tag': return groupByTag(conversations);
      case 'date':
      default: return groupByDate(conversations);
    }
  })();

  const hasItems = conversations.length > 0;

  return (
    <div
      role="navigation"
      aria-label="Conversation history"
      data-surface-widget=""
      data-widget-name="conversation-sidebar"
      data-part="root"
      data-state="idle"
      data-group-by={groupBy}
      tabIndex={0}
    >
      {/* Search input */}
      <div data-part="search" data-state="idle">
        <input
          type="search"
          data-part="search-input"
          placeholder={searchPlaceholder}
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
              const isSelected = item.id === selectedId;

              return (
                <div
                  key={item.id}
                  data-part="conversation-item"
                  data-selected={isSelected ? 'true' : 'false'}
                  data-active={item.isActive ? 'true' : 'false'}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${item.title} \u2014 ${formatRelativeTime(item.timestamp)}`}
                  tabIndex={isSelected ? 0 : -1}
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
                </div>
              );
            })}
          </div>
        ))}

        {/* Empty state */}
        {!hasItems && (
          <div data-part="empty-state" role="status" aria-live="polite">
            No conversations yet.
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export { ConversationSidebar };
