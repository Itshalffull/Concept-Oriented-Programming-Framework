import React, { useState, useCallback, useRef } from 'react';
import { View, Text, PanResponder, StyleSheet, type ViewStyle, type LayoutChangeEvent } from 'react-native';
export interface SliderProps { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; label: string; disabled?: boolean; onChange?: (value: number) => void; size?: 'sm'|'md'|'lg'; style?: ViewStyle; }
export const Slider: React.FC<SliderProps> = ({ value: vp, defaultValue = 0, min = 0, max = 100, step = 1, label, disabled = false, onChange, style }) => {
  const [int, setInt] = useState(defaultValue); const value = vp ?? int;
  const sv = useCallback((v: number) => { setInt(v); onChange?.(v); }, [onChange]);
  const tw = useRef(0); const clamp = useCallback((v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step)), [min, max, step]);
  const pct = ((value - min) / (max - min)) * 100;
  const pr = useRef(PanResponder.create({ onStartShouldSetPanResponder: () => !disabled, onMoveShouldSetPanResponder: () => !disabled, onPanResponderGrant: (_, gs) => { if (tw.current > 0) sv(clamp(min + (gs.x0 / tw.current) * (max - min))); }, onPanResponderMove: (_, gs) => { if (tw.current > 0) { const r = Math.max(0, Math.min(1, (gs.x0 + gs.dx) / tw.current)); sv(clamp(min + r * (max - min))); } } })).current;
  return (<View style={[styles.root, style]} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ now: value, min, max }}><Text style={styles.lbl}>{label}</Text><View style={styles.tc} onLayout={(e: LayoutChangeEvent) => { tw.current = e.nativeEvent.layout.width; }} {...pr.panHandlers}><View style={styles.trk}><View style={[styles.rng, { width: pct + '%' }]} /></View><View style={[styles.thm, { left: pct + '%' }, disabled && styles.thmD]} /></View><Text style={styles.out}>{value}</Text></View>);
};
const styles = StyleSheet.create({ root: {}, lbl: { fontSize: 14, fontWeight: '500', color: '#1e293b', marginBottom: 8 }, tc: { height: 30, justifyContent: 'center' }, trk: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 }, rng: { height: 4, backgroundColor: '#3b82f6', borderRadius: 2 }, thm: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#3b82f6', marginLeft: -10, top: 5, elevation: 3 }, thmD: { backgroundColor: '#94a3b8' }, out: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 } });
Slider.displayName = 'Slider'; export default Slider;
