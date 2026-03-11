import React, { useState, useCallback, useRef } from 'react';
import { View, TextInput as RNTextInput, StyleSheet, type ViewStyle } from 'react-native';

export interface PinInputProps {
  length?: number; value?: string; mask?: boolean; disabled?: boolean; onChange?: (value: string) => void; onComplete?: (value: string) => void; style?: ViewStyle;
}

export const PinInput: React.FC<PinInputProps> = (props) => {
  const { length, value, mask, disabled, onChange, onComplete, style, style } = props;
  const len = length || 4;
  const [digits, setDigits] = useState(value ? value.split('') : Array(len).fill(''));
  const refs = useRef<any[]>([]);
  const handleChange = useCallback((text: string, idx: number) => {
    const char = text.slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    const val = next.join('');
    onChange?.(val);
    if (char && idx < len - 1) refs.current[idx + 1]?.focus();
    if (next.every(d => d.length > 0)) onComplete?.(val);
  }, [digits, len, onChange, onComplete]);
  return (<View style={[s.root, style]} accessibilityRole="text" accessibilityLabel="PIN input">{digits.map((d, i) => (<RNTextInput key={i} ref={el => { refs.current[i] = el; }} value={mask ? (d ? '\u2022' : '') : d} onChangeText={t => handleChange(t, i)} maxLength={1} keyboardType="number-pad" editable={!disabled} style={s.cell} accessibilityLabel={`Digit ${i + 1}`} />))}</View>);
};

const s = StyleSheet.create({
  root: { flexDirection: 'row', gap: 8 }, cell: { width: 44, height: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, textAlign: 'center', fontSize: 20, color: '#1e293b' }
});

PinInput.displayName = 'PinInput';
export default PinInput;
