import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface LabelDef { id: string; name: string; color: string; }

export interface ColorLabelPickerProps {
  labels: LabelDef[]; selected?: string[]; multiple?: boolean;
  onSelect?: (ids: string[]) => void; style?: ViewStyle;
}

export const ColorLabelPicker: React.FC<ColorLabelPickerProps> = ({
  labels, selected = [], multiple = true, onSelect, style,
}) => {
  const [sel, setSel] = useState<string[]>(selected);
  const handlePress = useCallback((id: string) => {
    const next = sel.includes(id) ? sel.filter(s => s !== id) : multiple ? [...sel, id] : [id];
    setSel(next); onSelect?.(next);
  }, [sel, multiple, onSelect]);

  return (
    <View style={[styles.root, style]} accessibilityRole="radiogroup">{labels.map(l => {
      const isSelected = sel.includes(l.id);
      return (
        <Pressable key={l.id} onPress={() => handlePress(l.id)} style={[styles.label, isSelected && styles.selected]} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }}>
          <View style={[styles.dot, { backgroundColor: l.color }]} /><Text style={styles.name}>{l.name}</Text>
        </Pressable>
      );
    })}</View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  label: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  selected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  name: { fontSize: 13, color: '#1e293b' },
});

ColorLabelPicker.displayName = 'ColorLabelPicker';
export default ColorLabelPicker;
