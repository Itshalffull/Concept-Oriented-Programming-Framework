export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT'; value?: string }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT'; variable?: string }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, Switch, ScrollView, StyleSheet } from 'react-native';

export interface ExpressionToggleInputProps {
  value: string;
  mode: string;
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  variables?: string[];
  expression?: string;
  previewValue?: string;
  expressionValid?: boolean;
  onChange?: (value: string) => void;
  onExpressionChange?: (expression: string) => void;
  onToggleMode?: (mode: 'fixed' | 'expression') => void;
  children?: ReactNode;
}

const ExpressionToggleInput = forwardRef<View, ExpressionToggleInputProps>(function ExpressionToggleInput(
  {
    value,
    mode: _modeProp,
    fieldType = 'text',
    variables = [],
    expression: expressionProp = '',
    previewValue,
    expressionValid,
    onChange,
    onExpressionChange,
    onToggleMode,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(expressionToggleInputReducer, 'fixed');
  const [fixedValue, setFixedValue] = useState(value);
  const [expressionValue, setExpressionValue] = useState(expressionProp);
  const [acQuery, setAcQuery] = useState('');
  const [acIndex, setAcIndex] = useState(0);

  useEffect(() => { setFixedValue(value); }, [value]);
  useEffect(() => { setExpressionValue(expressionProp); }, [expressionProp]);

  const isExpressionMode = state !== 'fixed';

  const suggestions = useMemo(() => {
    if (!acQuery) return variables;
    const q = acQuery.toLowerCase();
    return variables.filter((v) => v.toLowerCase().includes(q));
  }, [variables, acQuery]);

  const handleToggle = useCallback(() => {
    const newMode = state === 'fixed' ? 'expression' : 'fixed';
    send({ type: 'TOGGLE' });
    onToggleMode?.(newMode as 'fixed' | 'expression');
  }, [state, onToggleMode]);

  const handleFixedChange = useCallback((newValue: string) => {
    setFixedValue(newValue);
    send({ type: 'INPUT', value: newValue });
    onChange?.(newValue);
  }, [onChange]);

  const handleExpressionChange = useCallback((newExpr: string) => {
    setExpressionValue(newExpr);
    send({ type: 'INPUT', value: newExpr });
    onExpressionChange?.(newExpr);

    const lastWord = newExpr.split(/[\s()+\-*/,]+/).pop() ?? '';
    if (lastWord.length > 0 && variables.some((v) => v.toLowerCase().startsWith(lastWord.toLowerCase()))) {
      setAcQuery(lastWord);
      setAcIndex(0);
      send({ type: 'SHOW_AC' });
    }
  }, [onExpressionChange, variables]);

  const handleSelectSuggestion = useCallback((variable: string) => {
    const parts = expressionValue.split(/[\s()+\-*/,]+/);
    const lastPart = parts[parts.length - 1] ?? '';
    const newExpr = expressionValue.slice(0, expressionValue.length - lastPart.length) + variable;
    setExpressionValue(newExpr);
    onExpressionChange?.(newExpr);
    send({ type: 'SELECT', variable });
  }, [expressionValue, onExpressionChange]);

  const renderFixedInput = () => {
    switch (fieldType) {
      case 'boolean':
        return (
          <View style={s.booleanRow}>
            <Switch
              value={fixedValue === 'true'}
              onValueChange={(val) => handleFixedChange(String(val))}
              accessibilityLabel="Fixed boolean value"
            />
            <Text style={s.booleanLabel}>{fixedValue === 'true' ? 'true' : 'false'}</Text>
          </View>
        );
      case 'number':
        return (
          <TextInput
            style={s.fixedInput}
            keyboardType="numeric"
            value={fixedValue}
            onChangeText={handleFixedChange}
            accessibilityLabel="Fixed number value"
          />
        );
      case 'object':
        return (
          <TextInput
            style={[s.fixedInput, s.multilineInput]}
            value={fixedValue}
            onChangeText={handleFixedChange}
            multiline
            numberOfLines={4}
            accessibilityLabel="Fixed object value (JSON)"
          />
        );
      case 'text':
      default:
        return (
          <TextInput
            style={s.fixedInput}
            value={fixedValue}
            onChangeText={handleFixedChange}
            accessibilityLabel="Fixed text value"
          />
        );
    }
  };

  return (
    <View ref={ref} testID="expression-toggle-input" accessibilityRole="none" accessibilityLabel="Expression toggle input" style={s.root}>
      {/* Mode toggle */}
      <Pressable
        onPress={handleToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: isExpressionMode }}
        accessibilityLabel="Expression mode"
        style={[s.modeToggle, isExpressionMode && s.modeToggleActive]}
      >
        <Text style={[s.modeToggleText, isExpressionMode && s.modeToggleTextActive]}>
          {isExpressionMode ? 'Expression' : 'Fixed'}
        </Text>
      </Pressable>

      {/* Fixed value input */}
      {!isExpressionMode && (
        <View style={s.inputContainer}>
          {renderFixedInput()}
        </View>
      )}

      {/* Expression editor */}
      {isExpressionMode && (
        <View style={s.inputContainer}>
          <TextInput
            style={[s.fixedInput, s.multilineInput]}
            value={expressionValue}
            onChangeText={handleExpressionChange}
            multiline
            numberOfLines={3}
            accessibilityLabel="Expression editor"
            spellCheck={false}
            autoCapitalize="none"
          />
        </View>
      )}

      {/* Autocomplete dropdown */}
      {state === 'autocompleting' && (
        <View style={s.autocomplete} accessibilityRole="none" accessibilityLabel="Variable suggestions">
          <ScrollView style={s.acList}>
            {suggestions.map((variable, index) => (
              <Pressable
                key={variable}
                onPress={() => handleSelectSuggestion(variable)}
                accessibilityRole="button"
                accessibilityState={{ selected: acIndex === index }}
                style={[s.acItem, acIndex === index && s.acItemFocused]}
              >
                <Text style={s.acItemText}>{variable}</Text>
              </Pressable>
            ))}
            {suggestions.length === 0 && (
              <View style={s.acItem}>
                <Text style={s.acEmptyText}>No matching variables</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Live preview */}
      {isExpressionMode && previewValue !== undefined && (
        <View style={s.preview}>
          <Text style={[s.previewValue, expressionValid === false && s.previewInvalid]}>{previewValue}</Text>
        </View>
      )}
      {isExpressionMode && previewValue === undefined && expressionValue !== '' && (
        <View style={s.preview}>
          <Text style={s.previewPlaceholder}>Enter expression to preview</Text>
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  modeToggle: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f3f4f6', marginBottom: 8 },
  modeToggleActive: { backgroundColor: '#6366f1' },
  modeToggleText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  modeToggleTextActive: { color: '#fff' },
  inputContainer: { marginBottom: 8 },
  fixedInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 14 },
  multilineInput: { minHeight: 60, textAlignVertical: 'top' },
  booleanRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  booleanLabel: { fontSize: 14, fontWeight: '600' },
  autocomplete: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, maxHeight: 120, marginBottom: 8 },
  acList: { flex: 1 },
  acItem: { paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  acItemFocused: { backgroundColor: '#ede9fe' },
  acItemText: { fontSize: 13, fontWeight: '500' },
  acEmptyText: { fontSize: 13, color: '#9ca3af' },
  preview: { backgroundColor: '#f9fafb', padding: 8, borderRadius: 4, marginTop: 4 },
  previewValue: { fontSize: 13, color: '#374151' },
  previewInvalid: { color: '#dc2626' },
  previewPlaceholder: { fontSize: 13, color: '#9ca3af' },
});

ExpressionToggleInput.displayName = 'ExpressionToggleInput';
export { ExpressionToggleInput };
export default ExpressionToggleInput;
