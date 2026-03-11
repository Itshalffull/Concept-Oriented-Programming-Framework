import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface ServiceDef { id: string; name: string; }
export interface ValidationError { line?: number; message: string; }

export interface PolicyEditorProps {
  value?: string; services?: ServiceDef[]; errors?: ValidationError[];
  onChange?: (value: string) => void; readOnly?: boolean; style?: ViewStyle;
}

export const PolicyEditor: React.FC<PolicyEditorProps> = ({ value = '', errors = [], onChange, readOnly = false, style }) => {
  const [content, setContent] = useState(value);
  const handleChange = useCallback((text: string) => { setContent(text); onChange?.(text); }, [onChange]);

  return (
    <View style={[styles.root, style]}>
      <RNTextInput value={content} onChangeText={handleChange} multiline editable={!readOnly} style={styles.editor} accessibilityLabel="Policy editor" placeholderTextColor="#94a3b8" />
      {errors.length > 0 && (<View style={styles.errors}>{errors.map((e, i) => (<Text key={i} style={styles.error}>{e.line ? `Line ${e.line}: ` : ''}{e.message}</Text>))}</View>)}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  editor: { minHeight: 200, fontSize: 13, fontFamily: 'monospace', color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 12, textAlignVertical: 'top' },
  errors: { marginTop: 8, padding: 8, backgroundColor: '#fef2f2', borderRadius: 6 },
  error: { fontSize: 12, color: '#ef4444', marginBottom: 2 },
});

PolicyEditor.displayName = 'PolicyEditor';
export default PolicyEditor;
