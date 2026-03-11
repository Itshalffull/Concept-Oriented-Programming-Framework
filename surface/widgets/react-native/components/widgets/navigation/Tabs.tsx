import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  style?: ViewStyle;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultValue,
  value: controlledValue,
  onValueChange,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || items[0]?.id || '');
  const activeId = controlledValue ?? internalValue;

  const handleSelect = useCallback((id: string) => {
    setInternalValue(id);
    onValueChange?.(id);
  }, [onValueChange]);

  const activeItem = items.find(item => item.id === activeId);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.tabList} accessibilityRole="tabbar">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <Pressable
              key={item.id}
              onPress={() => !item.disabled && handleSelect(item.id)}
              style={[styles.tab, isActive && styles.activeTab, item.disabled && styles.disabled]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled: item.disabled }}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.content}>{activeItem?.content}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  tabList: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { paddingVertical: 10, paddingHorizontal: 16 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  tabText: { fontSize: 14, color: '#64748b' },
  activeTabText: { color: '#3b82f6', fontWeight: '500' },
  content: { padding: 16 },
  disabled: { opacity: 0.4 },
});

Tabs.displayName = 'Tabs';
export default Tabs;
