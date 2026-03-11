import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, TextInput as RNTextInput, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface FacetItemDef { id: string; label: string; count?: number; }
export interface FacetDef { id: string; label: string; items: FacetItemDef[]; }
export interface ActiveFilter { facetId: string; itemId: string; }

export interface FacetedSearchProps {
  facets: FacetDef[];
  activeFilters?: ActiveFilter[];
  query?: string;
  placeholder?: string;
  onQueryChange?: (query: string) => void;
  onFilterToggle?: (facetId: string, itemId: string) => void;
  onClearAll?: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export const FacetedSearch: React.FC<FacetedSearchProps> = ({
  facets,
  activeFilters = [],
  query = '',
  placeholder = 'Search...',
  onQueryChange,
  onFilterToggle,
  onClearAll,
  children,
  style,
}) => {
  const [searchQuery, setSearchQuery] = useState(query);
  const handleSearch = useCallback((text: string) => { setSearchQuery(text); onQueryChange?.(text); }, [onQueryChange]);
  const isActive = (facetId: string, itemId: string) => activeFilters.some(f => f.facetId === facetId && f.itemId === itemId);

  return (
    <View style={[styles.root, style]}>
      <RNTextInput value={searchQuery} onChangeText={handleSearch} placeholder={placeholder} style={styles.input} placeholderTextColor="#94a3b8" accessibilityRole="search" />
      {activeFilters.length > 0 && (
        <View style={styles.activeRow}>
          <Pressable onPress={onClearAll} style={styles.clearButton}><Text style={styles.clearText}>Clear all</Text></Pressable>
        </View>
      )}
      <ScrollView style={styles.facets}>
        {facets.map(facet => (
          <View key={facet.id} style={styles.facet}>
            <Text style={styles.facetLabel}>{facet.label}</Text>
            {facet.items.map(item => (
              <Pressable key={item.id} onPress={() => onFilterToggle?.(facet.id, item.id)} style={styles.facetItem}>
                <Text style={styles.checkbox}>{isActive(facet.id, item.id) ? '\u2611' : '\u2610'}</Text>
                <Text style={styles.itemLabel}>{item.label}</Text>
                {item.count != null && <Text style={styles.count}>{item.count}</Text>}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  input: { fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12 },
  activeRow: { flexDirection: 'row', marginBottom: 8 },
  clearButton: {},
  clearText: { fontSize: 13, color: '#3b82f6' },
  facets: {},
  facet: { marginBottom: 12 },
  facetLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4 },
  facetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  checkbox: { fontSize: 16, marginRight: 6 },
  itemLabel: { flex: 1, fontSize: 14, color: '#1e293b' },
  count: { fontSize: 12, color: '#94a3b8' },
});

FacetedSearch.displayName = 'FacetedSearch';
export default FacetedSearch;
