import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface FieldsetProps {
  label: string;
  disabled?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  description?: string;
  children?: ReactNode;
  style?: ViewStyle;
}

export const Fieldset: React.FC<FieldsetProps> = ({
  label,
  disabled = false,
  collapsible = false,
  defaultOpen = true,
  description,
  children,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    if (collapsible) setIsOpen(prev => !prev);
  }, [collapsible]);

  return (
    <View style={[styles.root, disabled && styles.disabled, style]} accessibilityRole="summary" accessibilityLabel={label}>
      <Pressable onPress={handleToggle} disabled={!collapsible} style={styles.legend}>
        <Text style={styles.legendText}>{label}</Text>
        {collapsible && <Text style={styles.indicator}>{isOpen ? '\u25BC' : '\u25B6'}</Text>}
      </Pressable>
      {description && <Text style={styles.description}>{description}</Text>}
      {(!collapsible || isOpen) && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12 },
  disabled: { opacity: 0.5 },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  indicator: { fontSize: 10, color: '#64748b', marginLeft: 8 },
  description: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  content: {},
});

Fieldset.displayName = 'Fieldset';
export default Fieldset;
