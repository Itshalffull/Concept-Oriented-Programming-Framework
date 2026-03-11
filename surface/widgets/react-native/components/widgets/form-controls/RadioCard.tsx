import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
export interface RadioCardOption { value: string; label: string; description?: string; icon?: string; }
export interface RadioCardProps { value?: string; defaultValue?: string; options: RadioCardOption[]; label: string; disabled?: boolean; columns?: number; onChange?: (value: string) => void; size?: 'sm'|'md'|'lg'; style?: ViewStyle; }
export const RadioCard: React.FC<RadioCardProps> = ({ value: vp, defaultValue = '', options, label, disabled = false, onChange, style }) => {
  const [int, setInt] = useState(defaultValue); const value = vp ?? int;
  const sv = useCallback((v: string) => { setInt(v); onChange?.(v); }, [onChange]);
  return (<View style={[styles.root, style]} accessibilityRole="radiogroup" accessibilityLabel={label}><Text style={styles.lbl}>{label}</Text><View style={styles.grid}>{options.map((o) => { const sel = o.value === value; return <Pressable key={o.value} onPress={() => !disabled && sv(o.value)} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: sel, disabled }} accessibilityLabel={o.label} style={[styles.card, sel && styles.cardS, disabled && styles.cardD]}><Text style={[styles.cardL, sel && styles.cardLS]}>{o.label}</Text>{o.description && <Text style={styles.cardDsc}>{o.description}</Text>}</Pressable>; })}</View></View>);
};
const styles = StyleSheet.create({ root: {}, lbl: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, card: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8, marginRight: 8, minWidth: '45%' }, cardS: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }, cardD: { opacity: 0.5 }, cardL: { fontSize: 14, fontWeight: '600', color: '#334155' }, cardLS: { color: '#1d4ed8' }, cardDsc: { fontSize: 12, color: '#64748b', marginTop: 4 } });
RadioCard.displayName = 'RadioCard'; export default RadioCard;
