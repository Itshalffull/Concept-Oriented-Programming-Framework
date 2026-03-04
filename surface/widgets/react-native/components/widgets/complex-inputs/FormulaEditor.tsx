import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface FormulaFunction { name: string; args: string[]; description?: string; }
export interface FormulaSuggestion { label: string; value: string; type?: string; }

export interface FormulaEditorProps {
  value?: string; placeholder?: string; disabled?: boolean; readOnly?: boolean; onChange?: (formula: string) => void; style?: ViewStyle;
}

export const FormulaEditor: React.FC<FormulaEditorProps> = (props) => {
  const { value, placeholder, disabled, readOnly, onChange, style, style } = props;
  const [formula, setFormula] = useState(value ?? '');
  const handleChange = useCallback((text: string) => { setFormula(text); onChange?.(text); }, [onChange]);
  return (<View style={[s.root, style]}><Text style={s.prefix}>fx</Text><RNTextInput value={formula} onChangeText={handleChange} placeholder={placeholder || 'Enter formula...'} editable={!disabled && !readOnly} style={s.input} accessibilityLabel="Formula editor" placeholderTextColor="#94a3b8" /></View>);
};

const s = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' }, prefix: { fontSize: 14, fontWeight: '600', color: '#64748b', paddingHorizontal: 10, backgroundColor: '#f8fafc' }, input: { flex: 1, fontSize: 14, color: '#1e293b', paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'monospace' }
});

FormulaEditor.displayName = 'FormulaEditor';
export default FormulaEditor;
