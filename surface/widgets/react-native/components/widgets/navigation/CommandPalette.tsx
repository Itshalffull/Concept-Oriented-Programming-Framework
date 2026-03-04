import React, { useState, useCallback, useMemo, type ReactNode } from 'react';
import { View, Text, TextInput as RNTextInput, Pressable, Modal, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface CommandItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  group?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  open?: boolean;
  items: CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
  closeOnSelect?: boolean;
  onOpenChange?: (open: boolean) => void;
  onQueryChange?: (query: string) => void;
  filterFn?: (item: CommandItem, query: string) => boolean;
  footer?: ReactNode;
  style?: ViewStyle;
}

const defaultFilter = (item: CommandItem, query: string) =>
  item.label.toLowerCase().includes(query.toLowerCase());

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open = false,
  items,
  placeholder = 'Type a command...',
  emptyMessage = 'No results found.',
  closeOnSelect = true,
  onOpenChange,
  onQueryChange,
  filterFn = defaultFilter,
  footer,
  style,
}) => {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filtered = useMemo(() =>
    query ? items.filter(item => filterFn(item, query)) : items,
  [items, query, filterFn]);

  const handleClose = useCallback(() => {
    setQuery('');
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleSelect = useCallback((item: CommandItem) => {
    item.onSelect?.();
    if (closeOnSelect) handleClose();
  }, [closeOnSelect, handleClose]);

  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
    setHighlightedIndex(0);
    onQueryChange?.(text);
  }, [onQueryChange]);

  if (!open) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.content, style]} onPress={() => {}}>
          <RNTextInput
            value={query}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            style={styles.input}
            autoFocus
            placeholderTextColor="#94a3b8"
            accessibilityRole="search"
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => !item.disabled && handleSelect(item)}
                style={[styles.item, index === highlightedIndex && styles.highlighted, item.disabled && styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: item.disabled }}
              >
                {item.icon && <View style={styles.itemIcon}>{item.icon}</View>}
                <Text style={styles.itemLabel}>{item.label}</Text>
                {item.shortcut && <Text style={styles.shortcut}>{item.shortcut}</Text>}
              </Pressable>
            )}
            ListEmptyComponent={query.length > 0 ? <Text style={styles.empty}>{emptyMessage}</Text> : null}
          />
          {footer && <View style={styles.footer}>{footer}</View>}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 100 },
  content: { backgroundColor: '#fff', borderRadius: 12, width: '90%', maxWidth: 480, maxHeight: 400, overflow: 'hidden' },
  input: { fontSize: 16, padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', color: '#1e293b' },
  list: { maxHeight: 280 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  highlighted: { backgroundColor: '#f1f5f9' },
  disabled: { opacity: 0.4 },
  itemIcon: { marginRight: 10 },
  itemLabel: { flex: 1, fontSize: 14, color: '#1e293b' },
  shortcut: { fontSize: 12, color: '#94a3b8', marginLeft: 8 },
  empty: { padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  footer: { padding: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
});

CommandPalette.displayName = 'CommandPalette';
export default CommandPalette;
