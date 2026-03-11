import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface RichTextEditorProps {
  value?: string; defaultValue?: string; placeholder?: string; label?: string; readOnly?: boolean; disabled?: boolean; onChange?: (html: string) => void; style?: ViewStyle;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = (props) => {
  const { value, defaultValue, placeholder, label, readOnly, disabled, onChange, style, style } = props;
  const [content, setContent] = useState(value ?? defaultValue ?? '');
  const handleChange = useCallback((text: string) => { setContent(text); onChange?.(text); }, [onChange]);
  return (<View style={[s.root, style]} accessibilityLabel={label || 'Rich text editor'}><View style={s.toolbar}><Text style={s.toolbarLabel}>B I U</Text></View><RNTextInput value={content} onChangeText={handleChange} placeholder={placeholder} editable={!disabled && !readOnly} multiline style={s.editor} placeholderTextColor="#94a3b8" /></View>);
};

const s = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' }, toolbar: { flexDirection: 'row', padding: 8, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, toolbarLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' }, editor: { minHeight: 120, padding: 12, fontSize: 14, color: '#1e293b', textAlignVertical: 'top' }
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;
