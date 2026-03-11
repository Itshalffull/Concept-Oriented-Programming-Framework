import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface DataListItem {
  label: string;
  value: ReactNode;
}

export interface DataListProps {
  items: DataListItem[];
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}

export const DataList: React.FC<DataListProps> = ({
  items,
  orientation = 'vertical',
  style,
}) => (
  <View style={[styles.root, style]} accessibilityRole="list">
    {items.map((item, i) => (
      <View key={`${item.label}-${i}`} style={[styles.item, orientation === 'horizontal' && styles.itemHorizontal]}>
        <Text style={styles.label}>{item.label}</Text>
        <View style={styles.value}>
          {typeof item.value === 'string' ? <Text style={styles.valueText}>{item.value}</Text> : item.value}
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  root: {},
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemHorizontal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '500', marginBottom: 2 },
  value: {},
  valueText: { fontSize: 14, color: '#1e293b' },
});

DataList.displayName = 'DataList';
export default DataList;
