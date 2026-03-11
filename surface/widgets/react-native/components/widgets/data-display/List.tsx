import React, { type ReactNode } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface ListItem {
  id: string;
  primary: string;
  secondary?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}

export interface ListProps {
  items: ListItem[];
  onItemPress?: (id: string) => void;
  style?: ViewStyle;
}

export const List: React.FC<ListProps> = ({
  items,
  onItemPress,
  style,
}) => (
  <FlatList
    data={items}
    keyExtractor={(item) => item.id}
    style={style}
    accessibilityRole="list"
    renderItem={({ item }) => (
      <Pressable
        onPress={() => { item.onPress?.(); onItemPress?.(item.id); }}
        style={styles.item}
        accessibilityRole="button"
      >
        {item.leading && <View style={styles.leading}>{item.leading}</View>}
        <View style={styles.content}>
          <Text style={styles.primary}>{item.primary}</Text>
          {item.secondary && <Text style={styles.secondary}>{item.secondary}</Text>}
        </View>
        {item.trailing && <View style={styles.trailing}>{item.trailing}</View>}
      </Pressable>
    )}
  />
);

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  leading: { marginRight: 12 },
  content: { flex: 1 },
  primary: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  secondary: { fontSize: 13, color: '#64748b', marginTop: 2 },
  trailing: { marginLeft: 12 },
});

List.displayName = 'List';
export default List;
