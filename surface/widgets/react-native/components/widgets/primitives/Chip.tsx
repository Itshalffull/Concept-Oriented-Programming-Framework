import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

// Props from chip.widget spec
export interface ChipProps {
  label?: string;
  selected?: boolean;
  deletable?: boolean;
  disabled?: boolean;
  color?: string;
  value?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
  icon?: ReactNode;
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label = '',
  selected = false,
  deletable = false,
  disabled = false,
  color,
  value,
  onSelect,
  onDeselect,
  onDelete,
  icon,
  style,
}) => {
  const [removed, setRemoved] = useState(false);
  const isSelected = selected;

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (isSelected) {
      onDeselect?.();
    } else {
      onSelect?.();
    }
  }, [disabled, isSelected, onSelect, onDeselect]);

  const handleDelete = useCallback(() => {
    if (disabled) return;
    setRemoved(true);
    onDelete?.();
  }, [disabled, onDelete]);

  if (removed) return null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={label}
      style={[
        styles.root,
        isSelected ? styles.rootSelected : styles.rootIdle,
        color ? { borderColor: color } : undefined,
        { opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.label, isSelected && styles.labelSelected]}>{label}</Text>
      {deletable && (
        <Pressable
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Remove"
          hitSlop={8}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteIcon}>{'\u00D7'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  rootIdle: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  rootSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: 13,
    color: '#334155',
  },
  labelSelected: {
    color: '#1d4ed8',
  },
  deleteButton: {
    marginLeft: 4,
  },
  deleteIcon: {
    fontSize: 16,
    color: '#64748b',
  },
});

Chip.displayName = 'Chip';
export default Chip;
