import React, { useState, useCallback } from 'react';
import { View, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface MentionTrigger { char: string; dataSource: string; }
export interface MentionSuggestion { id: string; label: string; value: string; description?: string; }
export interface MentionChip { label: string; value: string; triggerChar: string; }

export interface MentionInputProps {
  triggers?: MentionTrigger[]; value?: string; placeholder?: string; disabled?: boolean; readOnly?: boolean; onChange?: (value: string) => void; style?: ViewStyle;
}

export const MentionInput: React.FC<MentionInputProps> = (props) => {
  const { triggers, value, placeholder, disabled, readOnly, onChange, style, style } = props;
  const [text, setText] = useState(value ?? '');
  const handleChange = useCallback((t: string) => { setText(t); onChange?.(t); }, [onChange]);
  return (<View style={[s.root, style]}><RNTextInput value={text} onChangeText={handleChange} placeholder={placeholder} editable={!disabled && !readOnly} style={s.input} accessibilityLabel="Mention input" multiline placeholderTextColor="#94a3b8" /></View>);
};

const s = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6 }, input: { fontSize: 14, color: '#1e293b', padding: 10, minHeight: 60 }
});

MentionInput.displayName = 'MentionInput';
export default MentionInput;
