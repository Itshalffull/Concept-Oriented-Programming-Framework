import React, { useState, useCallback } from 'react';
import { View, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface DatePickerProps {
  value?: string; placeholder?: string; disabled?: boolean; minDate?: string; maxDate?: string; onChange?: (date: string) => void; style?: ViewStyle;
}

export const DatePicker: React.FC<DatePickerProps> = (props) => {
  const { value, placeholder, disabled, minDate, maxDate, onChange, style, style } = props;
  const [date, setDate] = useState(value ?? '');
  const handleChange = useCallback((text: string) => { setDate(text); onChange?.(text); }, [onChange]);
  return (<View style={[s.root, style]}><RNTextInput value={date} onChangeText={handleChange} placeholder={placeholder || 'YYYY-MM-DD'} editable={!disabled} style={s.input} accessibilityLabel="Date picker" placeholderTextColor="#94a3b8" /></View>);
};

const s = StyleSheet.create({
  root: {}, input: { fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 }
});

DatePicker.displayName = 'DatePicker';
export default DatePicker;
