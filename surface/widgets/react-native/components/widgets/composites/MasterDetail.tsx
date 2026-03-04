import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, type ViewStyle } from 'react-native';

export interface MasterDetailItem {
  id: string;
  label: string;
  description?: string;
}

export interface MasterDetailProps {
  items: MasterDetailItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  renderDetail?: (item: MasterDetailItem) => ReactNode;
  style?: ViewStyle;
}

export const MasterDetail: React.FC<MasterDetailProps> = ({
  items,
  selectedId,
  onSelect,
  renderDetail,
  style,
}) => {
  const [internalId, setInternalId] = useState(selectedId || items[0]?.id);
  const activeId = selectedId ?? internalId;
  const selectedItem = items.find(i => i.id === activeId);

  const handleSelect = useCallback((id: string) => {
    setInternalId(id);
    onSelect?.(id);
  }, [onSelect]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.master}>
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => handleSelect(item.id)} style={[styles.item, item.id === activeId && styles.activeItem]} accessibilityRole="button" accessibilityState={{ selected: item.id === activeId }}>
              <Text style={[styles.itemLabel, item.id === activeId && styles.activeLabel]}>{item.label}</Text>
              {item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
            </Pressable>
          )}
        />
      </View>
      <View style={styles.detail}>
        {selectedItem && renderDetail ? renderDetail(selectedItem) : selectedItem && <Text style={styles.detailText}>{selectedItem.label}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flex: 1 },
  master: { width: '35%', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  activeItem: { backgroundColor: '#eff6ff' },
  itemLabel: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  activeLabel: { color: '#3b82f6' },
  itemDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  detail: { flex: 1, padding: 16 },
  detailText: { fontSize: 16, color: '#1e293b' },
});

MasterDetail.displayName = 'MasterDetail';
export default MasterDetail;
