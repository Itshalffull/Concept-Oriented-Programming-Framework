import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
export interface SegmentOption { value: string; label: string; }
export interface SegmentedControlProps { value?: string; defaultValue?: string; options: SegmentOption[]; size?: 'sm'|'md'; label: string; disabled?: boolean; onChange?: (value: string) => void; style?: ViewStyle; }
export const SegmentedControl: React.FC<SegmentedControlProps> = ({ value: vp, defaultValue, options, size = 'md', label, disabled = false, onChange, style }) => {
  const [int, setInt] = useState(defaultValue ?? (options[0]?.value ?? '')); const value = vp ?? int;
  const sv = useCallback((v: string) => { setInt(v); onChange?.(v); }, [onChange]);
  return (<View style={[styles.root, style]} accessibilityRole="radiogroup" accessibilityLabel={label}><View style={styles.track}>{options.map((o) => { const sel = o.value === value; return <Pressable key={o.value} onPress={() => !disabled && sv(o.value)} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: sel, disabled }} accessibilityLabel={o.label} style={[styles.seg, sel && styles.segS, size === 'sm' && styles.segSm]}><Text style={[styles.segL, sel && styles.segLS]}>{o.label}</Text></Pressable>; })}</View></View>);
};
const styles = StyleSheet.create({ root: {}, track: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2 }, seg: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' }, segS: { backgroundColor: '#fff', elevation: 2 }, segSm: { paddingVertical: 6 }, segL: { fontSize: 14, color: '#64748b', fontWeight: '500' }, segLS: { color: '#1e293b', fontWeight: '600' } });
SegmentedControl.displayName = 'SegmentedControl'; export default SegmentedControl;
