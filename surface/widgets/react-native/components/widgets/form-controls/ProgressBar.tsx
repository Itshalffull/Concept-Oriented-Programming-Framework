import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
export interface ProgressBarProps { value?: number; min?: number; max?: number; label?: string; showValueText?: boolean; size?: 'sm'|'md'|'lg'; style?: ViewStyle; }
const hm: Record<string, number> = { sm: 4, md: 8, lg: 12 };
export const ProgressBar: React.FC<ProgressBarProps> = ({ value, min = 0, max = 100, label, showValueText = false, size = 'md', style }) => {
  const ind = value === undefined; const pct = ind ? 0 : Math.round(((value! - min) / (max - min)) * 100); const h = hm[size];
  return (<View style={[styles.root, style]} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Progress'} accessibilityValue={ind ? undefined : { now: value, min, max }}>{label && <Text style={styles.lbl}>{label}</Text>}<View style={[styles.trk, { height: h }]}><View style={[styles.fill, { width: ind ? '100%' : pct + '%', height: h }]} /></View>{showValueText && !ind && <Text style={styles.val}>{pct}%</Text>}</View>);
};
const styles = StyleSheet.create({ root: {}, lbl: { fontSize: 13, color: '#475569', marginBottom: 4 }, trk: { backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }, fill: { backgroundColor: '#3b82f6', borderRadius: 4 }, val: { marginTop: 4, fontSize: 12, color: '#64748b', textAlign: 'right' } });
ProgressBar.displayName = 'ProgressBar'; export default ProgressBar;
