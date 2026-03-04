import React, { useState, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

// Props from text-input.widget spec
export interface TextInputProps {
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  name?: string;
  label?: string;
  description?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onChange?: (value: string) => void;
  onClear?: () => void;
  style?: ViewStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  value = '',
  placeholder = '',
  required = false,
  disabled = false,
  readOnly = false,
  maxLength,
  name,
  label,
  description,
  error,
  prefix,
  suffix,
  onChange,
  onClear,
  style,
}) => {
  const [focused, setFocused] = useState(false);

  const isInvalid = !!error;
  const isFilled = value.length > 0;

  const handleChange = useCallback(
    (text: string) => {
      onChange?.(text);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange?.('');
    onClear?.();
  }, [onChange, onClear]);

  return (
    <View style={[styles.root, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          isInvalid && styles.inputWrapperError,
          disabled && styles.inputWrapperDisabled,
        ]}
      >
        {prefix && <View style={styles.prefix}>{prefix}</View>}
        <RNTextInput
          value={value}
          placeholder={placeholder}
          editable={!disabled && !readOnly}
          maxLength={maxLength}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityRole="text"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          accessibilityHint={error || description}
          style={styles.input}
          placeholderTextColor="#94a3b8"
        />
        {suffix && <View style={styles.suffix}>{suffix}</View>}
        {isFilled && !disabled && !readOnly && (
          <Pressable onPress={handleClear} accessibilityLabel="Clear input" hitSlop={8}>
            <Text style={styles.clearButton}>{'\u00D7'}</Text>
          </Pressable>
        )}
      </View>
      {description && !error && (
        <Text style={styles.description}>{description}</Text>
      )}
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
  },
  required: {
    color: '#ef4444',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    minHeight: 40,
  },
  inputWrapperFocused: {
    borderColor: '#3b82f6',
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  inputWrapperDisabled: {
    backgroundColor: '#f1f5f9',
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    paddingVertical: 8,
  },
  prefix: {
    marginRight: 6,
  },
  suffix: {
    marginLeft: 6,
  },
  clearButton: {
    fontSize: 18,
    color: '#94a3b8',
    paddingHorizontal: 4,
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
});

TextInput.displayName = 'TextInput';
export default TextInput;
