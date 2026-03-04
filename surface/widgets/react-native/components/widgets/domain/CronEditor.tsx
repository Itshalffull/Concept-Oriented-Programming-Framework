import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface CronEditorProps {
  value?: string; onChange?: (cron: string) => void; disabled?: boolean; style?: ViewStyle;
}

export const CronEditor: React.FC<CronEditorProps> = ({ value = '* * * * *', onChange, disabled = false, style }) => {
  const [cron, setCron] = useState(value);
  const handleChange = useCallback((text: string) => { setCron(text); onChange?.(text); }, [onChange]);
  const parts = cron.split(' ');
  const labels = ['Minute', 'Hour', 'Day', 'Month', 'Weekday'];

  return (
    <View style={[styles.root, style]}>
      <RNTextInput value={cron} onChangeText={handleChange} editable={!disabled} style={styles.input} accessibilityLabel="Cron expression" placeholderTextColor="#94a3b8" />
      <View style={styles.parts}>{labels.map((l, i) => (<View key={l} style={styles.part}><Text style={styles.partValue}>{parts[i] || '*'}</Text><Text style={styles.partLabel}>{l}</Text></View>))}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  input: { fontSize: 16, fontFamily: 'monospace', color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, textAlign: 'center', marginBottom: 12 },
  parts: { flexDirection: 'row', justifyContent: 'space-around' },
  part: { alignItems: 'center' },
  partValue: { fontSize: 16, fontWeight: '600', color: '#1e293b', fontFamily: 'monospace' },
  partLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
});

CronEditor.displayName = 'CronEditor';
export default CronEditor;
