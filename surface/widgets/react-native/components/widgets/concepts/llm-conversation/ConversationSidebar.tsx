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

import React, { forwardRef, useCallback, useMemo, useReducer, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';

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

interface ConversationGroup { label: string; items: ConversationItem[]; }

function groupByDate(conversations: ConversationItem[]): ConversationGroup[] {
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
  return Object.entries(buckets).filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
}

function groupByFolder(conversations: ConversationItem[]): ConversationGroup[] {
  const map = new Map<string, ConversationItem[]>();
  for (const c of conversations) { const folder = c.folder ?? 'Ungrouped'; if (!map.has(folder)) map.set(folder, []); map.get(folder)!.push(c); }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
}

function groupByTag(conversations: ConversationItem[]): ConversationGroup[] {
  const map = new Map<string, ConversationItem[]>();
  for (const c of conversations) { const tags = c.tags && c.tags.length > 0 ? c.tags : ['Untagged']; for (const tag of tags) { if (!map.has(tag)) map.set(tag, []); map.get(tag)!.push(c); } }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '\u2026';
}

export interface ConversationSidebarProps {
  conversations: ConversationItem[];
  selectedId?: string | undefined;
  groupBy?: 'date' | 'folder' | 'tag';
  showPreview?: boolean;
  showModel?: boolean;
  previewMaxLength?: number;
  onSelect?: (id: string) => void;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onContextAction?: (action: ContextMenuAction, id: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

const ConversationSidebar = forwardRef<View, ConversationSidebarProps>(function ConversationSidebar(
  { conversations, selectedId, groupBy = 'date', showPreview = true, showModel = true, previewMaxLength = 80,
    onSelect, onCreate, onDelete, onContextAction, searchPlaceholder = 'Search conversations\u2026', children },
  ref,
) {
  const [state, send] = useReducer(conversationSidebarReducer, 'idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const groups = useMemo(() => {
    switch (groupBy) {
      case 'folder': return groupByFolder(filtered);
      case 'tag': return groupByTag(filtered);
      default: return groupByDate(filtered);
    }
  }, [filtered, groupBy]);

  const flatItems = useMemo(() => { const r: ConversationItem[] = []; for (const g of groups) for (const item of g.items) r.push(item); return r; }, [groups]);

  const handleSelect = useCallback((id: string) => { send({ type: 'SELECT' }); setSearchQuery(''); onSelect?.(id); }, [onSelect]);

  const handleContextAction = useCallback((action: ContextMenuAction) => {
    if (contextMenuId) { if (action === 'delete') onDelete?.(contextMenuId); onContextAction?.(action, contextMenuId); }
    setContextMenuId(null); send({ type: 'ACTION' });
  }, [contextMenuId, onDelete, onContextAction]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim() && state !== 'searching') send({ type: 'SEARCH' });
    else if (!value.trim() && state === 'searching') send({ type: 'CLEAR_SEARCH' });
  }, [state]);

  const sections = useMemo(() => groups.map((g) => ({ title: g.label, data: g.items })), [groups]);

  return (
    <View ref={ref} testID="conversation-sidebar" accessibilityRole="none" accessibilityLabel="Conversation history" style={s.root}>
      <TextInput value={searchQuery} onChangeText={handleSearchChange} placeholder={searchPlaceholder}
        style={s.searchInput} accessibilityLabel="Search conversations" />
      {onCreate && (
        <Pressable onPress={onCreate} accessibilityRole="button" accessibilityLabel="New conversation" style={s.newBtn}>
          <Text style={s.newBtnText}>+ New conversation</Text>
        </Pressable>
      )}
      <FlatList
        data={flatItems}
        keyExtractor={(item) => item.id}
        style={s.list}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId;
          return (
            <View>
              <Pressable onPress={() => handleSelect(item.id)}
                onLongPress={() => { setContextMenuId(item.id); send({ type: 'CONTEXT_MENU' }); }}
                accessibilityRole="button" accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${item.title} \u2014 ${formatRelativeTime(item.timestamp)}`}
                style={[s.item, isSelected && s.itemSel]}>
                <Text style={s.itemTitle} numberOfLines={1}>{item.title}</Text>
                {showPreview && <Text style={s.itemPreview} numberOfLines={1}>{truncate(item.lastMessage, previewMaxLength)}</Text>}
                <View style={s.itemMeta}>
                  <Text style={s.itemTs}>{formatRelativeTime(item.timestamp)}</Text>
                  <Text style={s.itemCount}>{item.messageCount}</Text>
                  {showModel && item.model && <Text style={s.itemModel}>{item.model}</Text>}
                </View>
              </Pressable>
              {state === 'contextOpen' && contextMenuId === item.id && (
                <View style={s.contextMenu}>
                  {(['rename', 'delete', 'archive', 'share'] as const).map((action) => (
                    <Pressable key={action} onPress={() => handleContextAction(action)} accessibilityRole="button" style={s.contextItem}>
                      <Text style={[s.contextItemText, action === 'delete' && s.contextDelete]}>
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => { setContextMenuId(null); send({ type: 'CLOSE_CONTEXT' }); }} style={s.contextItem}>
                    <Text style={s.contextItemText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>{searchQuery.trim() ? 'No conversations match your search.' : 'No conversations yet.'}</Text>
          </View>
        }
      />
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  searchInput: { margin: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, fontSize: 13 },
  newBtn: { marginHorizontal: 8, marginBottom: 8, padding: 10, backgroundColor: '#6366f1', borderRadius: 6, alignItems: 'center' },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  list: { flex: 1 },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemSel: { backgroundColor: '#dbeafe' },
  itemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemPreview: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTs: { fontSize: 11, color: '#9ca3af' },
  itemCount: { fontSize: 11, color: '#9ca3af' },
  itemModel: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, color: '#6b7280' },
  contextMenu: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, marginHorizontal: 12, marginBottom: 4, overflow: 'hidden' },
  contextItem: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  contextItemText: { fontSize: 13 },
  contextDelete: { color: '#ef4444' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
});

ConversationSidebar.displayName = 'ConversationSidebar';
export { ConversationSidebar };
export default ConversationSidebar;
