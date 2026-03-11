import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  sortable?: boolean;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onSort?: (column: string, direction: 'ascending' | 'descending') => void;
  onRowSelect?: (index: number) => void;
  footer?: ReactNode;
  pagination?: ReactNode;
  style?: ViewStyle;
}

export const DataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  sortable = true,
  selectable = false,
  loading = false,
  emptyMessage = 'No data available',
  onSort,
  onRowSelect,
  footer,
  pagination,
  style,
}: DataTableProps<T>) => {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleSort = useCallback((col: string) => {
    if (!sortable) return;
    const newDir = sortCol === col && sortDir === 'ascending' ? 'descending' : 'ascending';
    setSortCol(col);
    setSortDir(newDir);
    onSort?.(col, newDir);
  }, [sortable, sortCol, sortDir, onSort]);

  const handleRowPress = useCallback((index: number) => {
    if (!selectable) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
    onRowSelect?.(index);
  }, [selectable, onRowSelect]);

  if (loading) return <View style={[styles.root, style]}><Text style={styles.message}>Loading...</Text></View>;
  if (data.length === 0) return <View style={[styles.root, style]}><Text style={styles.message}>{emptyMessage}</Text></View>;

  return (
    <ScrollView horizontal style={style}>
      <View style={styles.root} accessibilityRole="grid">
        <View style={styles.headerRow}>
          {columns.map(col => (
            <Pressable key={col.key} onPress={() => col.sortable !== false && handleSort(col.key)} style={styles.headerCell}>
              <Text style={styles.headerText}>{col.header}</Text>
              {sortCol === col.key && <Text style={styles.sortIndicator}>{sortDir === 'ascending' ? '\u25B2' : '\u25BC'}</Text>}
            </Pressable>
          ))}
        </View>
        {data.map((row, i) => (
          <Pressable key={i} onPress={() => handleRowPress(i)} style={[styles.row, selected.has(i) && styles.selectedRow]}>
            {columns.map(col => (
              <View key={col.key} style={styles.cell}>
                {col.render ? col.render(row[col.key], row) : <Text style={styles.cellText}>{String(row[col.key] ?? '')}</Text>}
              </View>
            ))}
          </Pressable>
        ))}
        {footer && <View style={styles.footer}>{footer}</View>}
        {pagination && <View style={styles.pagination}>{pagination}</View>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerCell: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, minWidth: 100 },
  headerText: { fontSize: 12, fontWeight: '600', color: '#475569', textTransform: 'uppercase' },
  sortIndicator: { fontSize: 8, color: '#3b82f6', marginLeft: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  selectedRow: { backgroundColor: '#eff6ff' },
  cell: { flex: 1, padding: 10, minWidth: 100, justifyContent: 'center' },
  cellText: { fontSize: 14, color: '#1e293b' },
  message: { padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  footer: { padding: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  pagination: { padding: 10 },
});

DataTable.displayName = 'DataTable';
export default DataTable;
