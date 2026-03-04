import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, type ViewStyle } from 'react-native';

export interface MenuItem {
  type: 'item' | 'separator' | 'group';
  label?: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
  items?: MenuItem[];
  groupLabel?: string;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  open?: boolean;
  closeOnSelect?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: ViewStyle;
}

export const Menu: React.FC<MenuProps> = ({
  trigger,
  items,
  open: controlledOpen,
  closeOnSelect = true,
  onOpenChange,
  style,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  const handleClose = useCallback(() => {
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleSelect = useCallback((item: MenuItem) => {
    item.onSelect?.();
    if (closeOnSelect) handleClose();
  }, [closeOnSelect, handleClose]);

  const renderItems = (menuItems: MenuItem[]) =>
    menuItems.map((item, i) => {
      if (item.type === 'separator') {
        return <View key={`sep-${i}`} style={styles.separator} />;
      }
      if (item.type === 'group' && item.items) {
        return (
          <View key={`group-${i}`}>
            {item.groupLabel && <Text style={styles.groupLabel}>{item.groupLabel}</Text>}
            {renderItems(item.items)}
          </View>
        );
      }
      return (
        <Pressable
          key={`item-${i}`}
          onPress={() => !item.disabled && handleSelect(item)}
          style={[styles.item, item.disabled && styles.disabled]}
          accessibilityRole="menuitem"
          accessibilityState={{ disabled: item.disabled }}
        >
          {item.icon && <View style={styles.itemIcon}>{item.icon}</View>}
          <Text style={styles.itemLabel}>{item.label}</Text>
          {item.shortcut && <Text style={styles.shortcut}>{item.shortcut}</Text>}
        </Pressable>
      );
    });

  return (
    <View style={style}>
      <Pressable onPress={handleToggle} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
        {trigger}
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View style={styles.menu} accessibilityRole="menu">
            {renderItems(items)}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  menu: { backgroundColor: '#fff', borderRadius: 8, paddingVertical: 4, minWidth: 200, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  disabled: { opacity: 0.4 },
  itemIcon: { marginRight: 10 },
  itemLabel: { flex: 1, fontSize: 14, color: '#1e293b' },
  shortcut: { fontSize: 12, color: '#94a3b8' },
  separator: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  groupLabel: { fontSize: 12, color: '#94a3b8', paddingHorizontal: 16, paddingVertical: 6, fontWeight: '600' },
});

Menu.displayName = 'Menu';
export default Menu;
