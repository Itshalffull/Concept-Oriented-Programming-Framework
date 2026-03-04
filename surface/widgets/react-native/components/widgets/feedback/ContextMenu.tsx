import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, type ViewStyle } from 'react-native';

export interface ContextMenuItem {
  label: string;
  action: string;
  icon?: string;
  disabled?: boolean;
  destructive?: boolean;
  type?: 'item' | 'separator' | 'label';
}

export interface ContextMenuProps {
  items?: ContextMenuItem[];
  onSelect?: (action: string) => void;
  children: ReactNode;
  style?: ViewStyle;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items = [],
  onSelect,
  children,
  style,
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => { setOpen(true); }, []);
  const handleClose = useCallback(() => { setOpen(false); }, []);

  const handleSelect = useCallback((action: string) => {
    setOpen(false);
    onSelect?.(action);
  }, [onSelect]);

  return (
    <View style={style}>
      <Pressable onLongPress={handleOpen} accessibilityRole="button" accessibilityLabel="Open context menu">
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View style={styles.menu} accessibilityRole="menu">
            {items.map((item, index) => {
              if (item.type === 'separator') {
                return <View key={`sep-${index}`} style={styles.separator} />;
              }
              if (item.type === 'label') {
                return <Text key={`label-${index}`} style={styles.label}>{item.label}</Text>;
              }
              return (
                <Pressable
                  key={item.action}
                  onPress={() => !item.disabled && handleSelect(item.action)}
                  style={[styles.item, item.disabled && styles.itemDisabled]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ disabled: item.disabled }}
                >
                  <Text style={[styles.itemText, item.destructive && styles.destructiveText, item.disabled && styles.disabledText]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  menu: { backgroundColor: '#fff', borderRadius: 8, paddingVertical: 4, minWidth: 200, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  item: { paddingVertical: 10, paddingHorizontal: 16 },
  itemDisabled: { opacity: 0.4 },
  itemText: { fontSize: 14, color: '#1e293b' },
  destructiveText: { color: '#ef4444' },
  disabledText: { color: '#94a3b8' },
  separator: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  label: { fontSize: 12, color: '#94a3b8', paddingHorizontal: 16, paddingVertical: 6, fontWeight: '600' },
});

ContextMenu.displayName = 'ContextMenu';
export default ContextMenu;
