import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface OptionItem { value: string; label: string; disabled?: boolean; }

export interface CheckboxGroupProps {
  values?: string[];
  defaultValues?: string[];
  options: OptionItem[];
  orientation?: 'horizontal' | 'vertical';
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  min?: number;
  max?: number;
  onChange?: (values: string[]) => void;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  values: valuesProp, defaultValues = [], options, orientation = 'vertical',
  label, disabled = false, required = false, min, max, onChange, size = 'md', style,
}) => {
  const [internal, setInternal] = useState(defaultValues);
  const values = valuesProp ?? internal;
  const setValues = useCallback((v: string[]) => { setInternal(v); onChange?.(v); }, [onChange]);

  const handleToggle = useCallback((optionValue: string) => {
    if (disabled) return;
    const isChecked = values.includes(optionValue);
    if (isChecked) {
      if (min !== undefined && values.length <= min) return;
      setValues(values.filter((v) => v !== optionValue));
    } else {
      if (max !== undefined && values.length >= max) return;
      setValues([...values, optionValue]);
    }
  }, [disabled, values, min, max, setValues]);

  return (
    <View style={[styles.root, style]} accessibilityRole="none" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={orientation === 'horizontal' ? styles.horizontal : styles.vertical}>
        {options.map((option) => {
          const isChecked = values.includes(option.value);
          const isDisabled = option.disabled || disabled;
          return (
            <Pressable key={option.value} onPress={() => handleToggle(option.value)} disabled={isDisabled}
              accessibilityRole="checkbox" accessibilityState={{ checked: isChecked, disabled: isDisabled }}
              accessibilityLabel={option.label} style={[styles.item, { opacity: isDisabled ? 0.5 : 1 }]}>
              <View style={[styles.control, isChecked && styles.controlChecked]}>
                {isChecked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
              </View>
              <Text style={styles.itemLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  horizontal: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vertical: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center' },
  control: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  controlChecked: { borderColor: '#3b82f6', backgroundColor: '#3b82f6' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemLabel: { marginLeft: 8, fontSize: 15, color: '#334155' },
});

CheckboxGroup.displayName = 'CheckboxGroup';
export default CheckboxGroup;
