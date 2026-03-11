import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

// Props from checkbox.widget spec
export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
  label?: ReactNode;
  onChange?: (checked: boolean) => void;
  style?: ViewStyle;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked = false,
  indeterminate = false,
  disabled = false,
  required = false,
  value = '',
  name,
  label,
  onChange,
  style,
}) => {
  const [focused, setFocused] = useState(false);

  const isChecked = checked;

  const handleToggle = useCallback(() => {
    if (disabled) return;
    onChange?.(!isChecked);
  }, [disabled, isChecked, onChange]);

  const dataState = indeterminate
    ? 'indeterminate'
    : isChecked
      ? 'checked'
      : 'unchecked';

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? 'mixed' : isChecked,
        disabled,
      }}
      accessibilityLabel={typeof label === 'string' ? label : undefined}
      accessibilityHint={required ? 'Required field' : undefined}
      style={[styles.root, { opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View
        style={[
          styles.control,
          isChecked || indeterminate ? styles.controlChecked : styles.controlUnchecked,
          focused && styles.controlFocused,
        ]}
      >
        {(isChecked || indeterminate) && (
          <Text style={styles.indicator}>
            {indeterminate ? '\u2013' : '\u2713'}
          </Text>
        )}
      </View>
      {label && (
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  control: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlUnchecked: {
    borderColor: '#94a3b8',
    backgroundColor: 'transparent',
  },
  controlChecked: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  controlFocused: {
    borderColor: '#60a5fa',
  },
  indicator: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    marginLeft: 8,
    fontSize: 15,
    color: '#1e293b',
  },
  labelDisabled: {
    color: '#94a3b8',
  },
});

Checkbox.displayName = 'Checkbox';
export default Checkbox;
