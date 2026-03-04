import React, { useState, useCallback } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface DateRangePreset { label: string; start: string; end: string; }

export interface DateRangePickerProps {
  startDate?: string; endDate?: string; placeholder?: string; disabled?: boolean; onChange?: (range: { start: string; end: string }) => void; style?: ViewStyle;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = (props) => {
  const { startDate, endDate, placeholder, disabled, onChange, end, style, style } = props;
  const [start, setStart] = useState(startDate ?? '');
  const [end, setEnd] = useState(endDate ?? '');
  const handleStart = useCallback((t: string) => { setStart(t); onChange?.({ start: t, end }); }, [end, onChange]);
  const handleEnd = useCallback((t: string) => { setEnd(t); onChange?.({ start, end: t }); }, [start, onChange]);
  return (<View style={[s.root, style]}><RNTextInput value={start} onChangeText={handleStart} placeholder="Start date" editable={!disabled} style={s.input} placeholderTextColor="#94a3b8" accessibilityLabel="Start date" /><Text style={s.sep}>\u2013</Text><RNTextInput value={end} onChangeText={handleEnd} placeholder="End date" editable={!disabled} style={s.input} placeholderTextColor="#94a3b8" accessibilityLabel="End date" /></View>);
};

const s = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8 }, input: { flex: 1, fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 }, sep: { fontSize: 14, color: '#94a3b8' }
});

DateRangePicker.displayName = 'DateRangePicker';
export default DateRangePicker;
