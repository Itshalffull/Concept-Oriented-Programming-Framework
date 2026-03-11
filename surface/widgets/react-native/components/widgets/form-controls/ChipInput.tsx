import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface ChipInputProps {
  values?: string[];
  defaultValues?: string[];
  allowCreate?: boolean;
  maxItems?: number;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  suggestions?: string[];
  validateValue?: string;
  onChange?: (values: string[]) => void;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const ChipInput: React.FC<ChipInputProps> = ({
  values: valuesProp, defaultValues = [], allowCreate = true, maxItems,
  label, placeholder = 'Type and press Enter...', disabled = false,
  suggestions: suggestionsList = [], validateValue, onChange, size = 'md', style,
}) => {
  const [internal, setInternal] = useState(defaultValues);
  const values = valuesProp ?? internal;
  const setValues = useCallback((v: string[]) => { setInternal(v); onChange?.(v); }, [onChange]);
  const [inputText, setInputText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = useMemo(() =>
    suggestionsList.filter((s) => s.toLowerCase().includes(inputText.toLowerCase()) && !values.includes(s)),
    [suggestionsList, inputText, values]);

  const addChip = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed || values.includes(trimmed)) return;
    if (maxItems !== undefined && values.length >= maxItems) return;
    if (validateValue) { try { if (!new RegExp(validateValue).test(trimmed)) return; } catch {} }
    setValues([...values, trimmed]);
    setInputText('');
  }, [values, maxItems, validateValue, setValues]);

  const removeChip = useCallback((index: number) => {
    setValues(values.filter((_, i) => i !== index));
  }, [values, setValues]);

  return (
    <View style={[styles.root, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, disabled && styles.disabled]}>
        <View style={styles.chipList}>
          {values.map((val, i) => (
            <View key={val + '-' + i} style={styles.chip}>
              <Text style={styles.chipText}>{val}</Text>
              <Pressable onPress={() => removeChip(i)} accessibilityLabel={'Remove ' + val} hitSlop={4}>
                <Text style={styles.chipDelete}>{'×'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <TextInput value={inputText} placeholder={values.length === 0 ? placeholder : ''} placeholderTextColor="#94a3b8"
          editable={!disabled && !(maxItems !== undefined && values.length >= maxItems)}
          onChangeText={(t) => { setInputText(t); setShowSuggestions(true); }}
          onSubmitEditing={() => { if (inputText.trim()) addChip(inputText); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          accessibilityLabel={label} style={styles.input} />
      </View>
      {showSuggestions && filtered.length > 0 && (
        <View style={styles.suggestions}>
          {filtered.map((s) => (
            <Pressable key={s} onPress={() => { addChip(s); setShowSuggestions(false); }} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  label: { fontSize: 14, fontWeight: '500', color: '#1e293b', marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 6, backgroundColor: '#fff', minHeight: 40 },
  disabled: { backgroundColor: '#f1f5f9', opacity: 0.6 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 13, color: '#334155' },
  chipDelete: { fontSize: 16, color: '#64748b', marginLeft: 4 },
  input: { flex: 1, minWidth: 80, fontSize: 15, color: '#1e293b', paddingVertical: 4 },
  suggestions: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, backgroundColor: '#fff', marginTop: 2, maxHeight: 150 },
  suggestion: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestionText: { fontSize: 14, color: '#334155' },
});

ChipInput.displayName = 'ChipInput';
export default ChipInput;
