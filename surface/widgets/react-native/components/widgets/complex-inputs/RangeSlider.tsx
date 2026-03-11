import React, { useState } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

export interface RangeSliderProps {
  min?: number; max?: number; step?: number; value?: [number, number]; defaultValue?: [number, number]; disabled?: boolean; onChange?: (value: [number, number]) => void; style?: ViewStyle;
}

export const RangeSlider: React.FC<RangeSliderProps> = (props) => {
  const { min, max, step, value, defaultValue, disabled, onChange, style, style } = props;
  const [range, setRange] = useState<[number, number]>(value ?? defaultValue ?? [min ?? 0, max ?? 100]);
  return (<View style={[s.root, style]} accessibilityRole="adjustable" accessibilityLabel="Range slider" accessibilityValue={{ min: min ?? 0, max: max ?? 100 }}><View style={s.track}><View style={[s.fill, { left: `${((range[0] - (min ?? 0)) / ((max ?? 100) - (min ?? 0))) * 100}%`, right: `${100 - ((range[1] - (min ?? 0)) / ((max ?? 100) - (min ?? 0))) * 100}%` }]} /></View><View style={s.labels}><Text style={s.label}>{range[0]}</Text><Text style={s.label}>{range[1]}</Text></View></View>);
};

const s = StyleSheet.create({
  root: {}, track: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginVertical: 12 }, fill: { position: 'absolute', height: '100%', backgroundColor: '#3b82f6', borderRadius: 3 }, labels: { flexDirection: 'row', justifyContent: 'space-between' }, label: { fontSize: 13, color: '#64748b' }
});

RangeSlider.displayName = 'RangeSlider';
export default RangeSlider;
