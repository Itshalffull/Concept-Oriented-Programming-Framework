import React, { useState, useCallback } from 'react';
import { View, Text, Switch, StyleSheet, type ViewStyle } from 'react-native';
export interface ToggleSwitchProps { checked?: boolean; defaultChecked?: boolean; disabled?: boolean; label: string; onChange?: (checked: boolean) => void; size?: 'sm'|'md'|'lg'; style?: ViewStyle; }
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked: cp, defaultChecked = false, disabled = false, label, onChange, style }) => {
  const [int, setInt] = useState(defaultChecked); const checked = cp ?? int;
  const sc = useCallback((v: boolean) => { setInt(v); onChange?.(v); }, [onChange]);
  return (<View style={[styles.root, style]}><Switch value={checked} onValueChange={sc} disabled={disabled} trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={checked ? '#3b82f6' : '#f4f4f5'} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked, disabled }} /><Text style={[styles.lbl, disabled && styles.lblD]}>{label}</Text></View>);
};
const styles = StyleSheet.create({ root: { flexDirection: 'row', alignItems: 'center' }, lbl: { marginLeft: 8, fontSize: 15, color: '#1e293b' }, lblD: { color: '#94a3b8' } });
ToggleSwitch.displayName = 'ToggleSwitch'; export default ToggleSwitch;
