import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
export interface StepperProps { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; label: string; disabled?: boolean; onChange?: (value: number) => void; size?: 'sm'|'md'|'lg'; style?: ViewStyle; }
export const Stepper: React.FC<StepperProps> = ({ value: vp, defaultValue = 0, min = 0, max = 10, step = 1, label, disabled = false, onChange, style }) => {
  const [int, setInt] = useState(defaultValue); const value = vp ?? int;
  const sv = useCallback((v: number) => { const c = Math.min(max, Math.max(min, v)); setInt(c); onChange?.(c); }, [min, max, onChange]);
  const atMin = value <= min; const atMax = value >= max;
  return (<View style={[styles.root, style]} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ now: value, min, max }}><Text style={styles.lbl}>{label}</Text><View style={styles.row}><Pressable onPress={() => sv(value - step)} disabled={disabled || atMin} accessibilityLabel="Decrease" style={[styles.btn, (disabled || atMin) && styles.btnD]}><Text style={styles.btnT}>\u2212</Text></Pressable><Text style={styles.val}>{value}</Text><Pressable onPress={() => sv(value + step)} disabled={disabled || atMax} accessibilityLabel="Increase" style={[styles.btn, (disabled || atMax) && styles.btnD]}><Text style={styles.btnT}>+</Text></Pressable></View></View>);
};
const styles = StyleSheet.create({ root: {}, lbl: { fontSize: 14, fontWeight: '500', color: '#1e293b', marginBottom: 4 }, row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, backgroundColor: '#fff' }, btn: { paddingHorizontal: 14, paddingVertical: 10 }, btnD: { opacity: 0.3 }, btnT: { fontSize: 18, color: '#3b82f6', fontWeight: '600' }, val: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#1e293b' } });
Stepper.displayName = 'Stepper'; export default Stepper;
