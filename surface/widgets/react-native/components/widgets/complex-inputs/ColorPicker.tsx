import React, { useState, useCallback } from 'react';
import { View, TextInput as RNTextInput, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface ColorPickerProps {
  value?: string; defaultValue?: string; format?: 'hex' | 'rgb' | 'hsl'; swatches?: string[]; disabled?: boolean; name?: string; alpha?: boolean; onChange?: (color: string) => void; style?: ViewStyle;
}

export const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const { value, defaultValue, format, swatches, disabled, name, alpha, onChange, style, style } = props;
  const [color, setColor] = useState(value ?? defaultValue ?? '#000000');
  const handleChange = useCallback((c: string) => { setColor(c); onChange?.(c); }, [onChange]);
  return (<View style={[s.root, style]}><View style={[s.preview, { backgroundColor: color }]} /><RNTextInput value={color} onChangeText={handleChange} editable={!disabled} style={s.input} accessibilityLabel="Color value" />{swatches && swatches.length > 0 && (<View style={s.swatches}>{swatches.map(sw => (<Pressable key={sw} onPress={() => handleChange(sw)} style={[s.swatch, { backgroundColor: sw }]} accessibilityLabel={sw} />))}</View>)}</View>);
};

const s = StyleSheet.create({
  root: {}, preview: { width: 40, height: 40, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }, input: { fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }, swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }, swatch: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }
});

ColorPicker.displayName = 'ColorPicker';
export default ColorPicker;
