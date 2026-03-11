import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
export interface OptionItem { value: string; label: string; disabled?: boolean; }
export interface RadioGroupProps { value?: string; defaultValue?: string; options: OptionItem[]; orientation?: 'horizontal'|'vertical'; label: string; disabled?: boolean; onChange?: (value: string) => void; size?: 'sm'|'md'|'lg'; style?: ViewStyle; }
export const RadioGroup: React.FC<RadioGroupProps> = ({ value: vp, defaultValue = '', options, orientation = 'vertical', label, disabled = false, onChange, style }) => {
  const [int, setInt] = useState(defaultValue); const value = vp ?? int;
  const sv = useCallback((v: string) => { setInt(v); onChange?.(v); }, [onChange]);
  return (<View style={[styles.root, style]} accessibilityRole="radiogroup" accessibilityLabel={label}><Text style={styles.lbl}>{label}</Text><View style={orientation === 'horizontal' ? styles.hz : styles.vt}>{options.map((o) => { const sel = o.value === value; const dis = o.disabled || disabled; return <Pressable key={o.value} onPress={() => !dis && sv(o.value)} disabled={dis} accessibilityRole="radio" accessibilityState={{ checked: sel, disabled: dis }} accessibilityLabel={o.label} style={[styles.item, { opacity: dis ? 0.5 : 1 }]}><View style={[styles.radio, sel && styles.radioS]}>{sel && <View style={styles.dot} />}</View><Text style={styles.itL}>{o.label}</Text></Pressable>; })}</View></View>);
};
const styles = StyleSheet.create({ root: {}, lbl: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 }, hz: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, vt: { gap: 10 }, item: { flexDirection: 'row', alignItems: 'center' }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' }, radioS: { borderColor: '#3b82f6' }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }, itL: { marginLeft: 8, fontSize: 15, color: '#334155' } });
RadioGroup.displayName = 'RadioGroup'; export default RadioGroup;
