import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface InlineEditProps {
  value: string; placeholder?: string; disabled?: boolean;
  onSave?: (value: string) => void; onCancel?: () => void; style?: ViewStyle;
}

export const InlineEdit: React.FC<InlineEditProps> = ({ value, placeholder, disabled = false, onSave, onCancel, style }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = useCallback(() => { setEditing(false); onSave?.(draft); }, [draft, onSave]);
  const handleCancel = useCallback(() => { setEditing(false); setDraft(value); onCancel?.(); }, [value, onCancel]);

  if (editing) {
    return (
      <View style={[styles.root, style]}>
        <RNTextInput value={draft} onChangeText={setDraft} style={styles.input} autoFocus accessibilityLabel="Edit value" />
        <Pressable onPress={handleSave} style={styles.saveButton}><Text style={styles.saveText}>\u2713</Text></Pressable>
        <Pressable onPress={handleCancel}><Text style={styles.cancelText}>\u2717</Text></Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={() => !disabled && setEditing(true)} style={[styles.root, style]} accessibilityRole="button" accessibilityHint="Tap to edit">
      <Text style={[styles.display, !value && styles.placeholder]}>{value || placeholder || 'Click to edit'}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  display: { fontSize: 14, color: '#1e293b', borderBottomWidth: 1, borderBottomColor: 'transparent', paddingVertical: 2 },
  placeholder: { color: '#94a3b8' },
  input: { flex: 1, fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  saveButton: { marginLeft: 6 },
  saveText: { fontSize: 18, color: '#22c55e' },
  cancelText: { fontSize: 18, color: '#ef4444', marginLeft: 4 },
});

InlineEdit.displayName = 'InlineEdit';
export default InlineEdit;
