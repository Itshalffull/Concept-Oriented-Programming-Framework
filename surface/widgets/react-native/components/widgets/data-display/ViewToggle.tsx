import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface ViewToggleOption {
  id: string;
  label: string;
  icon?: string;
}

export interface ViewToggleProps {
  options: ViewToggleOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  style?: ViewStyle;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  options,
  value: controlledValue,
  defaultValue,
  onValueChange,
  style,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || options[0]?.id || '');
  const activeValue = controlledValue ?? internalValue;

  const handleSelect = useCallback((id: string) => {
    setInternalValue(id);
    onValueChange?.(id);
  }, [onValueChange]);

  return (
    <View style={[styles.root, style]} accessibilityRole="radiogroup">
      {options.map(opt => {
        const isActive = opt.id === activeValue;
        return (
          <Pressable
            key={opt.id}
            onPress={() => handleSelect(opt.id)}
            style={[styles.option, isActive && styles.active]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 6, padding: 2 },
  option: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
  active: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  label: { fontSize: 13, color: '#64748b' },
  activeLabel: { color: '#1e293b', fontWeight: '500' },
});

ViewToggle.displayName = 'ViewToggle';
export default ViewToggle;
