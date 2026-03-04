import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface SidebarItem {
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  width?: number;
  miniWidth?: number;
  label?: string;
  header?: ReactNode;
  footer?: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: (href: string) => void;
  style?: ViewStyle;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  collapsible = true,
  width = 256,
  miniWidth = 64,
  label = 'Sidebar',
  header,
  footer,
  onCollapsedChange,
  onNavigate,
  style,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const currentWidth = isCollapsed ? miniWidth : width;

  const handleToggle = useCallback(() => {
    if (!collapsible) return;
    const next = !isCollapsed;
    setInternalCollapsed(next);
    onCollapsedChange?.(next);
  }, [collapsible, isCollapsed, onCollapsedChange]);

  const handleItemPress = useCallback((item: SidebarItem) => {
    item.onClick?.();
    if (item.href) onNavigate?.(item.href);
  }, [onNavigate]);

  return (
    <View style={[styles.root, { width: currentWidth }, style]} accessibilityRole="complementary" accessibilityLabel={label}>
      {header && <View style={styles.header}>{header}</View>}
      <ScrollView style={styles.content}>
        {groups.map((group, gi) => (
          <View key={`group-${gi}`} style={styles.group}>
            {group.label && !isCollapsed && <Text style={styles.groupLabel}>{group.label}</Text>}
            {group.items.map((item, ii) => (
              <Pressable
                key={`item-${gi}-${ii}`}
                onPress={() => handleItemPress(item)}
                style={[styles.item, item.active && styles.activeItem]}
                accessibilityRole="link"
                accessibilityState={{ selected: item.active }}
              >
                {item.icon && <View style={styles.itemIcon}>{item.icon}</View>}
                {!isCollapsed && <Text style={[styles.itemLabel, item.active && styles.activeLabel]}>{item.label}</Text>}
                {!isCollapsed && item.badge && <View style={styles.badge}>{item.badge}</View>}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      {footer && <View style={styles.footer}>{footer}</View>}
      {collapsible && (
        <Pressable onPress={handleToggle} style={styles.toggle} accessibilityRole="button" accessibilityLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Text style={styles.toggleText}>{isCollapsed ? '\u25B6' : '\u25C0'}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#f8fafc', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  header: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  content: { flex: 1 },
  group: { paddingVertical: 8 },
  groupLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', paddingHorizontal: 12, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginHorizontal: 4 },
  activeItem: { backgroundColor: '#e0f2fe' },
  itemIcon: { marginRight: 10 },
  itemLabel: { flex: 1, fontSize: 14, color: '#475569' },
  activeLabel: { color: '#0369a1', fontWeight: '500' },
  badge: { marginLeft: 8 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  toggle: { padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  toggleText: { fontSize: 12, color: '#94a3b8' },
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
