import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

export interface KanbanItem {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  onCardActivate?: (cardId: string) => void;
  onAddCard?: (columnId: string) => void;
  renderCard?: (item: KanbanItem, columnId: string) => ReactNode;
  style?: ViewStyle;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  onCardActivate,
  onAddCard,
  renderCard,
  style,
}) => (
  <ScrollView horizontal style={[styles.root, style]} accessibilityRole="grid" accessibilityLabel="Kanban board">
    {columns.map(col => (
      <View key={col.id} style={styles.column}>
        <View style={styles.columnHeader}>
          <Text style={styles.columnTitle}>{col.title}</Text>
          <Text style={styles.count}>{col.items.length}</Text>
        </View>
        <ScrollView style={styles.cardList}>
          {col.items.map(item => (
            <Pressable key={item.id} onPress={() => onCardActivate?.(item.id)} style={styles.card} accessibilityRole="button">
              {renderCard ? renderCard(item, col.id) : <Text style={styles.cardTitle}>{item.title}</Text>}
            </Pressable>
          ))}
        </ScrollView>
        {onAddCard && (
          <Pressable onPress={() => onAddCard(col.id)} style={styles.addButton} accessibilityLabel={`Add card to ${col.title}`}>
            <Text style={styles.addText}>+ Add</Text>
          </Pressable>
        )}
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { flexDirection: 'row' },
  column: { width: 280, marginRight: 12, backgroundColor: '#f8fafc', borderRadius: 8, padding: 8 },
  columnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  columnTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  count: { fontSize: 12, color: '#94a3b8', backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  cardList: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 6, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 14, color: '#1e293b' },
  addButton: { padding: 8, alignItems: 'center' },
  addText: { fontSize: 13, color: '#3b82f6' },
});

KanbanBoard.displayName = 'KanbanBoard';
export default KanbanBoard;
